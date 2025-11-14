namespace Mafia.Controllers;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.DTOs;
using Mafia.Enums;
using Mafia.Services;

[ApiController]
[Route("api/[controller]")]
public class RoleController : ControllerBase
{
    [HttpGet("roles")]
    public ActionResult<IEnumerable<RolesDTO>> Roles()
    {
        var roles = RoleInfo.GetAllRoles();
        return Ok(roles); 
    }
    
    [HttpPost("set")]
    public ActionResult<Dictionary<string, Role>> CreateRole(GameCreateDTO gameCreateDTO)
    {

        var res = Game.ShufflePlayersWithRoles(gameCreateDTO);
        return Ok(res);
    }
    
    
}