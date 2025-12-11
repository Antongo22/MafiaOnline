using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Mafia.DTOs;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestComtroller : ControllerBase
{

    /// <summary>
    /// Тестовый эндпоинт для проверки работы API
    /// </summary>
    [HttpGet("test")]
    public ActionResult<string> Test()
    {
        return Ok("Test");
    }
}