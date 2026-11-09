namespace SchoolAdmission.Api;

public sealed record AdmissionOptions(int HoldSeconds);

public enum R { Ok, NotFound, Forbidden, Conflict }

public sealed record Result<T>(R Kind, T? Value = default, string? Error = null)
{
    public static Result<T> Ok(T value) => new(R.Ok, value);
    public static Result<T> Fail(R kind, string error) => new(kind, default, error);
}

public sealed record CreateClassRequest(string? Name, int? TotalSeats);

public class ClassView
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int TotalSeats { get; set; }
    public int HeldSeats { get; set; }
    public int ConfirmedSeats { get; set; }
    public int AvailableSeats => Math.Max(0, TotalSeats - HeldSeats - ConfirmedSeats);
}

public class HoldView
{
    public string HoldId { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public class MyHoldView
{
    public string HoldId { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
