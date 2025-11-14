namespace Mafia.Controllers;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.DTOs;
using Mafia.Enums;


public class RoleController : ControllerBase
{
    [HttpGet("roles")]
    public ActionResult<IEnumerable<RolesDTO>> Roles()
    {
        var roles = RoleInfo.GetAllRoles();
        return Ok(roles); 
    }
}