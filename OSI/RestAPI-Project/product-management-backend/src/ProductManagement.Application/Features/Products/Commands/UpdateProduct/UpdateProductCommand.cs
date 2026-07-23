using MediatR;
using ProductManagement.Application.DTOs;
using ProductManagement.Domain.Repositories;

namespace ProductManagement.Application.Features.Products.Commands.UpdateProduct;

public record UpdateProductCommand(int Id, string Name, string Description, decimal Price, int Stock) : IRequest<ProductDto>;

public class UpdateProductCommandHandler : IRequestHandler<UpdateProductCommand, ProductDto>
{
    private readonly IProductRepository _productRepository;

    public UpdateProductCommandHandler(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<ProductDto> Handle(UpdateProductCommand request, CancellationToken cancellationToken)
    {
        var product = await _productRepository.GetByIdAsync(request.Id, cancellationToken);
        if (product == null)
        {
            throw new KeyNotFoundException($"Product with ID {request.Id} was not found.");
        }

        product.Name = request.Name;
        product.Description = request.Description;
        product.Price = request.Price;
        product.Stock = request.Stock;

        await _productRepository.UpdateAsync(product, cancellationToken);

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
