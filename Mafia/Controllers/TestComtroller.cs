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


    
}