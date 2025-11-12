using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.DTOs;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestComtroller : ControllerBase
{

    [HttpGet("test")]
    public ActionResult<string> Test()
    {
        return Ok("Test");
    }


    [HttpGet("roles")]
    public async Task<ActionResult<IEnumerable<RolesDTO>>> Roles()
    {
        var random = new Random();
        RolesDTO[] roles = Enumerable.Range(1, random.Next(1, 11))
            .Select(i => new RolesDTO { Id = i, Name = $"Role {i}" })
            .ToArray();
        return Ok(roles); 
    }
}