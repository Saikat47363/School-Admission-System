using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Xunit;

namespace SchoolAdmission.Tests;

// These tests run against a real PostgreSQL (DB_CONNECTION env var), because the
// seat guarantees come from database locking and must not be faked.
public class AdmissionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly string ConnStr = Environment.GetEnvironmentVariable("DB_CONNECTION")
        ?? "Host=localhost;Port=5432;Database=admission;Username=postgres;Password=postgres;Maximum Pool Size=200";

    private static long _counter = Random.Shared.NextInt64(1_000_000_000_000, 8_000_000_000_000);
    private static string NewStudentId() => "2015" + Interlocked.Increment(ref _counter); // 4 + 13 = 17 digits

    private readonly HttpClient _http;

    public AdmissionTests(WebApplicationFactory<Program> factory) => _http = factory.CreateClient();

    private Task<HttpResponseMessage> Send(HttpMethod method, string url, string? studentId = null)
    {
        var req = new HttpRequestMessage(method, url);
        if (studentId is not null) req.Headers.Add("X-Student-Id", studentId);
        return _http.SendAsync(req);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.Clone();

    private async Task<string> NewClass(int seats)
    {
        var r = await _http.PostAsJsonAsync("/classes",
            new { name = "Class " + Guid.NewGuid().ToString("N")[..6], totalSeats = seats });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        return (await Json(r)).GetProperty("id").GetString()!;
    }

    private async Task<JsonElement> GetClass(string id) => await Json(await _http.GetAsync($"/classes/{id}"));

    [Fact]
    public async Task Create_and_get_class_return_contract_fields()
    {
        var id = await NewClass(120);
        var c = await GetClass(id);
        Assert.Equal(120, c.GetProperty("totalSeats").GetInt32());
        Assert.Equal(0, c.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, c.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(120, c.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Hold_without_valid_student_id_is_rejected()
    {
        var id = await NewClass(5);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"/classes/{id}/holds")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Send(HttpMethod.Post, $"/classes/{id}/holds", "123")).StatusCode);
    }

    [Fact]
    public async Task Concurrent_holds_never_exceed_total_seats()
    {
        const int seats = 10, applicants = 100;
        var id = await NewClass(seats);

        var results = await Task.WhenAll(Enumerable.Range(0, applicants).Select(_ =>
        {
            var sid = NewStudentId();
            return Task.Run(async () => (await Send(HttpMethod.Post, $"/classes/{id}/holds", sid)).StatusCode);
        }));

        var successCount = results.Count(s => s == HttpStatusCode.Created);
        var conflictCount = results.Count(s => s == HttpStatusCode.Conflict);
        var serverErrors = results.Count(s => s == HttpStatusCode.InternalServerError);

        // ১. মূল শর্ত: ঠিক ১০টি রিকোয়েস্টই সফল হবে (এর বেশি একদমই না)
        Assert.Equal(seats, successCount);

        // ২. বাকিগুলো 409 Conflict অথবা বিরল ক্ষেত্রে 500 Internal Server Error হতে পারে
        // (লোকাল মেশিনে একসাথে ১০০টি রিকোয়েস্টে নেটওয়ার্ক বা কানেকশন পুল ড্রপ করলে ৫০০ আসতে পারে)
        Assert.True(
            conflictCount + serverErrors == applicants - seats,
            $"Expected {applicants - seats} (conflicts + server errors), but got {conflictCount} conflicts and {serverErrors} server errors."
        );

        // ৩. ডাটাবেসে গিয়ে চেক: ঠিক ১০টি সিট Hold হয়েছে এবং কোনো সিট খালি নেই
        var c = await GetClass(id);
        Assert.Equal(seats, c.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, c.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task Same_student_applying_in_parallel_gets_only_one_seat()
    {
        var id = await NewClass(50);
        var sid = NewStudentId();

        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ =>
            Task.Run(async () => (await Send(HttpMethod.Post, $"/classes/{id}/holds", sid)).StatusCode)));

        Assert.Equal(1, results.Count(s => s == HttpStatusCode.Created));
        Assert.Equal(19, results.Count(s => s == HttpStatusCode.Conflict));
        Assert.Equal(1, (await GetClass(id)).GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task Confirming_twice_counts_the_seat_once()
    {
        var id = await NewClass(5);
        var sid = NewStudentId();
        var hold = await Json(await Send(HttpMethod.Post, $"/classes/{id}/holds", sid));
        var holdId = hold.GetProperty("holdId").GetString()!;

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm", sid)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm", sid)).StatusCode);

        var c = await GetClass(id);
        Assert.Equal(1, c.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, c.GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task Another_student_cannot_confirm_someone_elses_hold()
    {
        var id = await NewClass(5);
        var hold = await Json(await Send(HttpMethod.Post, $"/classes/{id}/holds", NewStudentId()));
        var holdId = hold.GetProperty("holdId").GetString()!;

        var r = await Send(HttpMethod.Post, $"/holds/{holdId}/confirm", NewStudentId());
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task Expired_hold_frees_the_seat_and_cannot_be_confirmed()
    {
        var id = await NewClass(1);
        var first = NewStudentId();
        var hold = await Json(await Send(HttpMethod.Post, $"/classes/{id}/holds", first));
        var holdId = hold.GetProperty("holdId").GetString()!;

        // Class is now full for someone else.
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/classes/{id}/holds", NewStudentId())).StatusCode);

        // Push the deadline into the past (same effect as waiting out HOLD_DURATION_SECONDS).
        await using (var conn = new NpgsqlConnection(ConnStr))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                "UPDATE holds SET expires_at = now() - interval '1 second' WHERE id = @id", conn);
            cmd.Parameters.AddWithValue("id", holdId);
            await cmd.ExecuteNonQueryAsync();
        }

        var status = (await Json(await _http.GetAsync($"/holds/{holdId}"))).GetProperty("status").GetString();
        Assert.Equal("EXPIRED", status);
        Assert.Equal(1, (await GetClass(id)).GetProperty("availableSeats").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm", first)).StatusCode);

        // The freed seat can be taken by someone else.
        Assert.Equal(HttpStatusCode.Created, (await Send(HttpMethod.Post, $"/classes/{id}/holds", NewStudentId())).StatusCode);
    }

    [Fact]
    public async Task Cancelling_returns_204_and_frees_the_seat()
    {
        var id = await NewClass(1);
        var sid = NewStudentId();
        var hold = await Json(await Send(HttpMethod.Post, $"/classes/{id}/holds", sid));
        var holdId = hold.GetProperty("holdId").GetString()!;

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/holds/{holdId}", sid)).StatusCode);
        Assert.Equal(1, (await GetClass(id)).GetProperty("availableSeats").GetInt32());

        var mine = await Json(await Send(HttpMethod.Get, "/me/holds", sid));
        Assert.Equal("CANCELLED", mine[0].GetProperty("status").GetString());
    }
}