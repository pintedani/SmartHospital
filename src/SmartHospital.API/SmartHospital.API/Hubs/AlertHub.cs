using Microsoft.AspNetCore.SignalR;
using SmartHospital.API.DTOs;

namespace SmartHospital.API.Hubs;

public class AlertHub : Hub
{
    public async Task JoinHospitalGroup(int hospitalId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"hospital-{hospitalId}");
    }

    public async Task LeaveHospitalGroup(int hospitalId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"hospital-{hospitalId}");
    }
}
