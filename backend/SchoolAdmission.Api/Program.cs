using Npgsql;
using SchoolAdmission.Api;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration["DB_CONNECTION"]
    ?? "Host=localhost;Port=5432;Database=admission;Username=postgres;Password=postgres;Maximum Pool Size=200";
var holdSeconds = int.TryParse(builder.Configuration["HOLD_DURATION_SECONDS"], out var s) && s > 0 ? s : 600;

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton(new NpgsqlDataSourceBuilder(connectionString).Build());
builder.Services.AddSingleton(new AdmissionOptions(holdSeconds));
builder.Services.AddSingleton<AdmissionStore>();
builder.Services.AddHostedService<ExpiryService>();

var app = builder.Build();

await app.Services.GetRequiredService<AdmissionStore>().InitAsync();

app.UseExceptionHandler(a => a.Run(async ctx =>
{
    ctx.Response.StatusCode = 500;
    await ctx.Response.WriteAsJsonAsync(new { error = "Something went wrong on the server. Please try again." });
}));
app.UseCors();

static IResult Err(int status, string message) => Results.Json(new { error = message }, statusCode: status);

static string? StudentId(HttpContext ctx)
{
    var v = ctx.Request.Headers["X-Student-Id"].ToString().Trim();
    return v.Length == 17 && v.All(char.IsAsciiDigit) ? v : null;
}
const string BadStudent = "X-Student-Id header is required and must be a 17-digit birth registration number.";

static IResult ToHttp<T>(Result<T> r, int okStatus = 200) => r.Kind switch
{
    R.Ok => Results.Json(r.Value, statusCode: okStatus),
    R.NotFound => Err(404, r.Error!),
    R.Forbidden => Err(403, r.Error!),
    _ => Err(409, r.Error!),
};

// 1. Create class
app.MapPost("/classes", async (CreateClassRequest? req, AdmissionStore store) =>
{
    var name = req?.Name?.Trim();
    if (string.IsNullOrEmpty(name)) return Err(400, "Class name is required.");
    if (name.Length > 200) return Err(400, "Class name is too long (max 200 characters).");
    if (req?.TotalSeats is not int seats || seats < 1 || seats > 100_000)
        return Err(400, "totalSeats must be a whole number between 1 and 100000.");
    return Results.Json(await store.CreateClassAsync(name, seats), statusCode: 201);
});

// 2. List classes
app.MapGet("/classes", async (AdmissionStore store) => Results.Json(await store.ListClassesAsync()));

// 3. One class
app.MapGet("/classes/{classId}", async (string classId, AdmissionStore store) =>
    await store.GetClassAsync(classId) is { } c ? Results.Json(c) : Err(404, "Class not found."));

// 4. Apply (hold a seat)
app.MapPost("/classes/{classId}/holds", async (string classId, HttpContext ctx, AdmissionStore store) =>
    StudentId(ctx) is { } sid ? ToHttp(await store.CreateHoldAsync(classId, sid), 201) : Err(400, BadStudent));

// 5. Hold status
app.MapGet("/holds/{holdId}", async (string holdId, AdmissionStore store) =>
    await store.GetHoldAsync(holdId) is { } h ? Results.Json(h) : Err(404, "Application not found."));

// 6. Confirm (fee paid)
app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpContext ctx, AdmissionStore store) =>
    StudentId(ctx) is { } sid ? ToHttp(await store.ConfirmAsync(holdId, sid)) : Err(400, BadStudent));

// 7. Cancel
app.MapDelete("/holds/{holdId}", async (string holdId, HttpContext ctx, AdmissionStore store) =>
{
    if (StudentId(ctx) is not { } sid) return Err(400, BadStudent);
    var r = await store.CancelAsync(holdId, sid);
    return r.Kind == R.Ok ? Results.NoContent() : ToHttp(r);
});

// 8. My applications
app.MapGet("/me/holds", async (HttpContext ctx, AdmissionStore store) =>
    StudentId(ctx) is { } sid ? Results.Json(await store.MyHoldsAsync(sid)) : Err(400, BadStudent));

app.Run();

public partial class Program { } // lets the test project start the app in-process
