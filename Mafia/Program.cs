using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Mafia.Filters;
using Mafia.Hubs;
using Mafia.Services;
using Mafia.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.SetIsOriginAllowed(_ => true)
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .AllowCredentials();
        });
});

builder.Services.AddSignalR();

// Background services
// Регистрируем как singleton для инъекции в контроллеры
builder.Services.AddSingleton<GameTimerService>();
// Добавляем как hosted service используя уже зарегистрированный singleton
builder.Services.AddHostedService<GameTimerService>(provider => provider.GetRequiredService<GameTimerService>());

// HttpClient для LiveKit proxy
builder.Services.AddHttpClient();

builder.Services.AddHttpClient<VideoCallService>((sp, client) =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var callsApiUrl = config["CALLS_API_URL"] ?? "https://calls.trexon.ru/";
    var masterAdminKey = config["MASTER_ADMIN_KEY"] ?? "none";
    
    client.BaseAddress = new Uri(callsApiUrl);
    client.DefaultRequestHeaders.Add("X-API-Key", masterAdminKey);
});
builder.Services.AddTransient<IVideoCallService>(sp => sp.GetRequiredService<VideoCallService>());

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();


// Swagger
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Task Management System API",
        Version = "v1",
        Description = "API for managing tasks with JWT authentication"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter your token (without 'Bearer' prefix).",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    c.OperationFilter<SwaggerBearerTokenFilter>();
});


var app = builder.Build();

// Глобальный перехват ошибок
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Swagger - только для Development режима
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapHub<ChatHub>("/chatHub");
app.MapControllers();

app.Run();

// Делаем Program публичным для интеграционных тестов
public partial class Program { }
