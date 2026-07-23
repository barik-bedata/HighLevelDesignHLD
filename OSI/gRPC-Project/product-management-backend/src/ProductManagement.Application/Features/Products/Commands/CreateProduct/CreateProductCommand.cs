using MediatR;
using ProductManagement.Application.DTOs;
using ProductManagement.Domain.Entities;
using ProductManagement.Domain.Repositories;

namespace ProductManagement.Application.Features.Products.Commands.CreateProduct;

public record CreateProductCommand(string Name, string Description, decimal Price, int Stock) : IRequest<ProductDto>;

public class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, ProductDto>
{
    private readonly IProductRepository _productRepository;

    public CreateProductCommandHandler(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<ProductDto> Handle(CreateProductCommand request, CancellationToken cancellationToken)
    {
        var product = new Product
        {
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            Stock = request.Stock
        };

        await _productRepository.AddAsync(product, cancellationToken);

        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            Stock = product.Stock
        };
    }
}
