using ProductManagement.Application;
using ProductManagement.Infrastructure;
using ProductManagement.Infrastructure.Data;
using ProductManagement.Presentation.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddGrpc();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding");
    });
});

var app = builder.Build();

// Auto-create database schema on start (Supabase friendly)
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
app.UseRouting();
app.UseCors("AllowAll");
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.MapGrpcService<ProductGrpcService>()
   .EnableGrpcWeb()
   .RequireCors("AllowAll");

app.MapGet("/", () => "gRPC Product Management service is running. Connect using a gRPC-Web client.");

app.Run();
