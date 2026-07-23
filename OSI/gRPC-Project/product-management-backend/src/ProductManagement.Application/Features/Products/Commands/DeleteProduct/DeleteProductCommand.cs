using MediatR;
using ProductManagement.Domain.Repositories;

namespace ProductManagement.Application.Features.Products.Commands.DeleteProduct;

public record DeleteProductCommand(int Id) : IRequest<bool>;

public class DeleteProductCommandHandler : IRequestHandler<DeleteProductCommand, bool>
{
    private readonly IProductRepository _productRepository;

    public DeleteProductCommandHandler(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<bool> Handle(DeleteProductCommand request, CancellationToken cancellationToken)
    {
        var product = await _productRepository.GetByIdAsync(request.Id, cancellationToken);
        if (product == null)
        {
            return false;
        }

        await _productRepository.DeleteAsync(product, cancellationToken);
        return true;
    }
}
