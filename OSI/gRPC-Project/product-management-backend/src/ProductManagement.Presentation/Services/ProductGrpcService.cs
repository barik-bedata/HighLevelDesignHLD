using Grpc.Core;
using MediatR;
using ProductManagement.Application.DTOs;
using ProductManagement.Application.Features.Products.Commands.CreateProduct;
using ProductManagement.Application.Features.Products.Commands.DeleteProduct;
using ProductManagement.Application.Features.Products.Commands.UpdateProduct;
using ProductManagement.Application.Features.Products.Queries.GetAllProducts;
using ProductManagement.Application.Features.Products.Queries.GetProductById;
using ProductManagement.Presentation.Protos;

namespace ProductManagement.Presentation.Services;

public class ProductGrpcService : ProductService.ProductServiceBase
{
    private readonly IMediator _mediator;

    public ProductGrpcService(IMediator mediator)
    {
        _mediator = mediator;
    }

    public override async Task<ProductResponse> CreateProduct(CreateProductRequest request, ServerCallContext context)
    {
        var command = new CreateProductCommand(
            request.Name, 
            request.Description, 
            (decimal)request.Price, 
            request.Stock
        );

        var result = await _mediator.Send(command, context.CancellationToken);

        return new ProductResponse
        {
            Product = MapToProto(result)
        };
    }

    public override async Task<GetAllProductsResponse> GetAllProducts(GetAllProductsRequest request, ServerCallContext context)
    {
        var query = new GetAllProductsQuery();
        var result = await _mediator.Send(query, context.CancellationToken);

        var response = new GetAllProductsResponse();
        response.Products.AddRange(result.Select(MapToProto));

        return response;
    }

    public override async Task<ProductResponse> GetProductById(GetProductByIdRequest request, ServerCallContext context)
    {
        var query = new GetProductByIdQuery(request.Id);
        var result = await _mediator.Send(query, context.CancellationToken);

        if (result == null)
        {
            throw new RpcException(new Status(StatusCode.NotFound, $"Product with ID {request.Id} was not found."));
        }

        return new ProductResponse
        {
            Product = MapToProto(result)
        };
    }

    public override async Task<ProductResponse> UpdateProduct(UpdateProductRequest request, ServerCallContext context)
    {
        try
        {
            var command = new UpdateProductCommand(
                request.Id,
                request.Name,
                request.Description,
                (decimal)request.Price,
                request.Stock
            );

            var result = await _mediator.Send(command, context.CancellationToken);

            return new ProductResponse
            {
                Product = MapToProto(result)
            };
        }
        catch (KeyNotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
    }

    public override async Task<DeleteProductResponse> DeleteProduct(DeleteProductRequest request, ServerCallContext context)
    {
        var command = new DeleteProductCommand(request.Id);
        var success = await _mediator.Send(command, context.CancellationToken);

        return new DeleteProductResponse
        {
            Success = success
        };
    }

    private static Product MapToProto(ProductDto dto)
    {
        return new Product
        {
            Id = dto.Id,
            Name = dto.Name,
            Description = dto.Description,
            Price = (double)dto.Price,
            Stock = dto.Stock
        };
    }
}
