using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using SmartHospital.API.DTOs;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<HospitalManager> _userManager;
    private readonly IConfiguration _config;

    public AuthController(UserManager<HospitalManager> userManager, IConfiguration config)
    {
        _userManager = userManager;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponseDto>> Login([FromBody] LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user == null || !await _userManager.CheckPasswordAsync(user, dto.Password))
            return Unauthorized(new { Message = "Invalid email or password" });

        var token = GenerateToken(user);

        string? hospitalName = null;
        if (user.HospitalId.HasValue)
        {
            var hospital = await _userManager.GetClaimsAsync(user);
            // We'll get hospital name from a separate query if needed
        }

        return Ok(new LoginResponseDto(
            token, user.Email!, user.FullName, user.Role,
            user.HospitalId, hospitalName
        ));
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<LoginResponseDto>> GetMe()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return Unauthorized();

        return Ok(new LoginResponseDto(
            "", user.Email!, user.FullName, user.Role,
            user.HospitalId, null
        ));
    }

    private string GenerateToken(HospitalManager user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _config["Jwt:Key"] ?? "SmartHospitalSuperSecretKey2024!@#$%^&*()_+"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email!),
            new(ClaimTypes.Name, user.FullName),
            new("role", user.Role.ToString()),
        };

        if (user.HospitalId.HasValue)
            claims.Add(new Claim("hospitalId", user.HospitalId.Value.ToString()));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "SmartHospital",
            audience: _config["Jwt:Audience"] ?? "SmartHospital",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
