import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { createPromiseClient } from "@connectrpc/connect";
import { ProductService } from "./gen/products_connect";

const transport = createGrpcWebTransport({
  baseUrl: "http://localhost:5260",
});

export const productClient = createPromiseClient(ProductService, transport);
