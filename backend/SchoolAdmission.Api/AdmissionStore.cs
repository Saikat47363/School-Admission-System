using Dapper;
using Npgsql;

namespace SchoolAdmission.Api;

/// <summary>
/// All seat logic lives here. Correctness under concurrency comes from one rule:
/// every operation that changes seat usage first locks the class row (SELECT ... FOR UPDATE),
/// so requests for the same class are serialized by PostgreSQL itself. This also holds
/// when several backend processes share the same database.
/// Time is always taken from the database clock (now()) so processes never disagree.
/// </summary>
public sealed class AdmissionStore(NpgsqlDataSource db, AdmissionOptions opts)
{
    private const string Schema = """
        CREATE TABLE IF NOT EXISTS classes (
            id          text PRIMARY KEY,
            name        text NOT NULL,
            total_seats int  NOT NULL CHECK (total_seats > 0),
            created_at  timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS holds (
            id         text PRIMARY KEY,
            class_id   text NOT NULL REFERENCES classes(id),
            student_id text NOT NULL,
            status     text NOT NULL,
            expires_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        -- Safety net: one active (HELD/CONFIRMED) application per student per class.
        CREATE UNIQUE INDEX IF NOT EXISTS ux_holds_active
            ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED');
        CREATE INDEX IF NOT EXISTS ix_holds_student ON holds (student_id);
        """;

    // A HELD hold whose time ran out is reported as EXPIRED immediately, even before
    // the background job has rewritten the row.
    private const string HoldCols = """
        id AS HoldId, class_id AS ClassId, student_id AS StudentId,
        CASE WHEN status = 'HELD' AND expires_at <= now() THEN 'EXPIRED' ELSE status END AS Status,
        expires_at AS ExpiresAt
        """;

    private const string ClassSelect = """
        SELECT c.id AS Id, c.name AS Name, c.total_seats AS TotalSeats,
               (COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()))::int AS HeldSeats,
               (COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED'))::int AS ConfirmedSeats
        FROM classes c LEFT JOIN holds h ON h.class_id = c.id
        """;

    public async Task InitAsync()
    {
        // Postgres may still be starting; retry for ~30s.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var conn = await db.OpenConnectionAsync();
                // Advisory lock so two backend processes starting together don't race on DDL.
                await conn.ExecuteAsync("SELECT pg_advisory_lock(727001)");
                try { await conn.ExecuteAsync(Schema); }
                finally { await conn.ExecuteAsync("SELECT pg_advisory_unlock(727001)"); }
                return;
            }
            catch (Exception) when (attempt < 30)
            {
                await Task.Delay(1000);
            }
        }
    }

    // ---------- classes ----------

    public async Task<ClassView> CreateClassAsync(string name, int totalSeats)
    {
        var id = "c_" + Guid.NewGuid().ToString("N")[..8];
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync(
            "INSERT INTO classes (id, name, total_seats) VALUES (@id, @name, @totalSeats)",
            new { id, name, totalSeats });
        return new ClassView { Id = id, Name = name, TotalSeats = totalSeats };
    }

    public async Task<List<ClassView>> ListClassesAsync()
    {
        await using var conn = await db.OpenConnectionAsync();
        var rows = await conn.QueryAsync<ClassView>(
            ClassSelect + " GROUP BY c.id ORDER BY c.created_at, c.id");
        return rows.ToList();
    }

    public async Task<ClassView?> GetClassAsync(string id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<ClassView>(
            ClassSelect + " WHERE c.id = @id GROUP BY c.id", new { id });
    }

    // ---------- holds ----------

    public async Task<Result<HoldView>> CreateHoldAsync(string classId, string studentId)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        // 1. Lock the class row: everyone else wanting a seat in this class waits here.
        var total = await conn.ExecuteScalarAsync<int?>(
            "SELECT total_seats FROM classes WHERE id = @classId FOR UPDATE", new { classId }, tx);
        if (total is null)
            return Result<HoldView>.Fail(R.NotFound, "Class not found.");

        // 2. Release seats from holds whose time ran out.
        await conn.ExecuteAsync(
            "UPDATE holds SET status = 'EXPIRED' WHERE class_id = @classId AND status = 'HELD' AND expires_at <= now()",
            new { classId }, tx);

        // 3. One active application per student per class.
        var existing = await conn.ExecuteScalarAsync<string?>(
            "SELECT status FROM holds WHERE class_id = @classId AND student_id = @studentId AND status IN ('HELD','CONFIRMED') LIMIT 1",
            new { classId, studentId }, tx);
        if (existing is not null)
        {
            await tx.RollbackAsync();
            return Result<HoldView>.Fail(R.Conflict, existing == "CONFIRMED"
                ? "This student already has a confirmed admission in this class."
                : "This student already has an active application for this class.");
        }

        // 4. Seat check (expired holds were already released above).
        var used = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*)::int FROM holds WHERE class_id = @classId AND status IN ('HELD','CONFIRMED')",
            new { classId }, tx);
        if (used >= total.Value)
        {
            await tx.CommitAsync(); // keep the expiry cleanup from step 2
            return Result<HoldView>.Fail(R.Conflict, "No seats are available in this class.");
        }

        // 5. Take the seat.
        var hold = await conn.QuerySingleAsync<HoldView>(
            $"""
            INSERT INTO holds (id, class_id, student_id, status, expires_at)
            VALUES (@id, @classId, @studentId, 'HELD', now() + make_interval(secs => @secs))
            RETURNING {HoldCols}
            """,
            new { id = "h_" + Guid.NewGuid().ToString("N")[..12], classId, studentId, secs = (double)opts.HoldSeconds },
            tx);
        await tx.CommitAsync();
        return Result<HoldView>.Ok(hold);
    }

    public async Task<HoldView?> GetHoldAsync(string holdId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<HoldView>(
            $"SELECT {HoldCols} FROM holds WHERE id = @holdId", new { holdId });
    }

    private sealed class HoldRow
    {
        public string StudentId { get; set; } = "";
        public string Status { get; set; } = "";
        public bool Expired { get; set; }
    }

    public async Task<Result<HoldView>> ConfirmAsync(string holdId, string studentId)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        var row = await conn.QuerySingleOrDefaultAsync<HoldRow>(
            "SELECT student_id AS StudentId, status AS Status, expires_at <= now() AS Expired FROM holds WHERE id = @holdId FOR UPDATE",
            new { holdId }, tx);
        if (row is null)
            return Result<HoldView>.Fail(R.NotFound, "Application not found.");
        if (row.StudentId != studentId)
            return Result<HoldView>.Fail(R.Forbidden, "This application belongs to a different student.");

        string? error = null;
        if (row.Status == "HELD" && row.Expired)
        {
            await conn.ExecuteAsync("UPDATE holds SET status = 'EXPIRED' WHERE id = @holdId", new { holdId }, tx);
            error = "This application has expired. Please apply again.";
        }
        else if (row.Status == "HELD")
        {
            await conn.ExecuteAsync("UPDATE holds SET status = 'CONFIRMED' WHERE id = @holdId", new { holdId }, tx);
        }
        else if (row.Status == "EXPIRED") error = "This application has expired. Please apply again.";
        else if (row.Status == "CANCELLED") error = "This application was cancelled.";
        // row.Status == "CONFIRMED": already confirmed, return it unchanged (idempotent).

        var view = await conn.QuerySingleAsync<HoldView>(
            $"SELECT {HoldCols} FROM holds WHERE id = @holdId", new { holdId }, tx);
        await tx.CommitAsync();
        return error is null ? Result<HoldView>.Ok(view) : Result<HoldView>.Fail(R.Conflict, error);
    }

    public async Task<Result<bool>> CancelAsync(string holdId, string studentId)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();

        var row = await conn.QuerySingleOrDefaultAsync<HoldRow>(
            "SELECT student_id AS StudentId, status AS Status, expires_at <= now() AS Expired FROM holds WHERE id = @holdId FOR UPDATE",
            new { holdId }, tx);
        if (row is null)
            return Result<bool>.Fail(R.NotFound, "Application not found.");
        if (row.StudentId != studentId)
            return Result<bool>.Fail(R.Forbidden, "This application belongs to a different student.");

        if (row.Status == "CANCELLED") { await tx.CommitAsync(); return Result<bool>.Ok(true); } // idempotent
        if (row.Status == "CONFIRMED") { await tx.CommitAsync(); return Result<bool>.Fail(R.Conflict, "A confirmed admission cannot be cancelled."); }
        if (row.Status == "EXPIRED" || row.Expired)
        {
            await conn.ExecuteAsync("UPDATE holds SET status = 'EXPIRED' WHERE id = @holdId AND status = 'HELD'", new { holdId }, tx);
            await tx.CommitAsync();
            return Result<bool>.Fail(R.Conflict, "This application has already expired.");
        }

        await conn.ExecuteAsync("UPDATE holds SET status = 'CANCELLED' WHERE id = @holdId", new { holdId }, tx);
        await tx.CommitAsync();
        return Result<bool>.Ok(true);
    }

    public async Task<List<MyHoldView>> MyHoldsAsync(string studentId)
    {
        await using var conn = await db.OpenConnectionAsync();
        var rows = await conn.QueryAsync<MyHoldView>(
            """
            SELECT h.id AS HoldId, h.class_id AS ClassId, c.name AS ClassName,
                   CASE WHEN h.status = 'HELD' AND h.expires_at <= now() THEN 'EXPIRED' ELSE h.status END AS Status,
                   h.expires_at AS ExpiresAt
            FROM holds h JOIN classes c ON c.id = h.class_id
            WHERE h.student_id = @studentId
            ORDER BY h.created_at DESC
            """, new { studentId });
        return rows.ToList();
    }

    public async Task<int> ExpireStaleAsync()
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.ExecuteAsync(
            "UPDATE holds SET status = 'EXPIRED' WHERE status = 'HELD' AND expires_at <= now()");
    }
}
