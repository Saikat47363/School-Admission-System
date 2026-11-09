namespace SchoolAdmission.Api;

/// <summary>
/// Housekeeping only: rewrites timed-out HELD rows to EXPIRED. Seat counts and API
/// responses are already correct without it (they compare against the DB clock).
/// </summary>
public sealed class ExpiryService(AdmissionStore store, ILogger<ExpiryService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await store.ExpireStaleAsync(); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogWarning(ex, "Expiry sweep failed; will retry.");
            }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }
}
