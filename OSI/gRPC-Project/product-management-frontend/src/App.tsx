import React, { useState, useEffect, FormEvent } from "react";
import { productClient } from "./rpc";
import { Product } from "./gen/products_pb";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Layers, 
  Package, 
  AlertTriangle, 
  DollarSign,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface Toast {
  message: string;
  type: "success" | "error";
  id: number;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  
  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  
  // Request feedback state
  const [actionLoading, setActionLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Load products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productClient.getAllProducts({});
      setProducts(response.products);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditId(null);
    setName("");
    setDescription("");
    setPrice("");
    setStock("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setModalMode("edit");
    setEditId(product.id);
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stock) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock, 10);

    if (isNaN(priceNum) || priceNum < 0) {
      addToast("Please enter a valid price", "error");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      addToast("Please enter a valid stock level", "error");
      return;
    }

    setActionLoading(true);
    try {
      if (modalMode === "create") {
        await productClient.createProduct({
          name,
          description,
          price: priceNum,
          stock: stockNum
        });
        addToast(`Product "${name}" successfully created!`);
      } else {
        if (editId === null) return;
        await productClient.updateProduct({
          id: editId,
          name,
          description,
          price: priceNum,
          stock: stockNum
        });
        addToast(`Product "${name}" successfully updated!`);
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "An error occurred while saving", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }

    try {
      const response = await productClient.deleteProduct({ id });
      if (response.success) {
        addToast(`Product "${productName}" successfully deleted.`);
        fetchProducts();
      } else {
        addToast("Failed to delete product.", "error");
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "An error occurred while deleting", "error");
    }
  };

  // Filter products by search query
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary Metrics
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", flexWrap: "wrap", gap: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "36px", fontWeight: 700, background: "linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "flex", alignItems: "center", gap: "12px" }}>
            <Layers size={36} color="#6366f1" /> ProManage Console
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#94a3b8" }}>Enterprise Product Catalog over gRPC-Web</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={fetchProducts} className="btn btn-secondary" title="Reload Products" disabled={loading}>
            <RefreshCw size={18} className={loading ? "spinner" : ""} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={handleOpenCreateModal} className="btn btn-primary">
            <Plus size={18} /> Add Product
          </button>
        </div>
      </header>

      {/* METRIC SUMMARY CARDS */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "12px", color: "#6366f1" }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>Total Items</div>
            <div style={{ fontSize: "28px", fontWeight: 700 }}>{totalProducts}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.15)", borderRadius: "12px", color: "#10b981" }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>Total Inventory</div>
            <div style={{ fontSize: "28px", fontWeight: 700 }}>{totalStock}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(245, 158, 11, 0.15)", borderRadius: "12px", color: "#f59e0b" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>Out of Stock</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: outOfStockCount > 0 ? "#fca5a5" : "inherit" }}>{outOfStockCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", background: "rgba(139, 92, 246, 0.15)", borderRadius: "12px", color: "#8b5cf6" }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ color: "#94a3b8", fontSize: "14px" }}>Stock Value</div>
            <div style={{ fontSize: "28px", fontWeight: 700 }}>${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </section>

      {/* FILTER & SEARCH */}
      <section className="glass-panel" style={{ padding: "16px", marginBottom: "30px", display: "flex", alignItems: "center", gap: "12px" }}>
        <Search size={20} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Search products by name or description..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", outline: "none", width: "100%", fontFamily: "inherit" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}>
            <X size={18} />
          </button>
        )}
      </section>

      {/* MAIN PRODUCTS GRID OR LOADING STATE */}
      {loading && products.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div className="spinner" style={{ width: "48px", height: "48px", borderWidth: "4px", marginBottom: "20px" }}></div>
          <p style={{ color: "#94a3b8" }}>Connecting to gRPC Service...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <Package size={48} style={{ color: "#475569", marginBottom: "16px" }} />
          <h3 style={{ margin: "0 0 8px 0" }}>No Products Found</h3>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            {searchQuery ? "Try refining your search query." : "Start by adding your first product to the inventory database!"}
          </p>
          {!searchQuery && (
            <button onClick={handleOpenCreateModal} className="btn btn-primary" style={{ marginTop: "20px" }}>
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "25px" }}>
          {filteredProducts.map((product) => {
            const stockStatus = product.stock > 10 ? "success" : product.stock > 0 ? "warning" : "danger";
            const stockLabel = product.stock > 10 ? "In Stock" : product.stock > 0 ? "Low Stock" : "Out of Stock";

            return (
              <article key={product.id} className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: "20px", flexGrow: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <span className={`badge badge-${stockStatus}`}>
                      {stockLabel} ({product.stock})
                    </span>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#818cf8" }}>
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: 600 }}>{product.name}</h3>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px", lineBreak: "anywhere" }}>
                    {product.description || <span style={{ fontStyle: "italic", color: "#475569" }}>No description provided.</span>}
                  </p>
                </div>
                
                <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "flex-end", gap: "10px", background: "rgba(15, 23, 42, 0.2)", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px" }}>
                  <button onClick={() => handleOpenEditModal(product)} className="btn btn-secondary" style={{ padding: "8px 12px" }} title="Edit Product">
                    <Edit3 size={15} /> Edit
                  </button>
                  <button onClick={() => handleDelete(product.id, product.name)} className="btn btn-danger" style={{ padding: "8px 12px" }} title="Delete Product">
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: "30px", position: "relative" }}>
            <button onClick={() => setModalOpen(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}>
              <X size={20} />
            </button>
            <h2 style={{ margin: "0 0 24px 0", display: "flex", alignItems: "center", gap: "10px" }}>
              {modalMode === "create" ? <Plus size={24} /> : <Edit3 size={24} />}
              {modalMode === "create" ? "Add New Product" : "Edit Product"}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#94a3b8" }}>Product Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="form-input" 
                  placeholder="e.g. Mechanical Keyboard"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#94a3b8" }}>Description</label>
                <textarea 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="form-input" 
                  rows={3} 
                  placeholder="Describe the product details..."
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#94a3b8" }}>Price (USD) <span style={{ color: "#ef4444" }}>*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
                    className="form-input" 
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#94a3b8" }}>Stock Quantity <span style={{ color: "#ef4444" }}>*</span></label>
                  <input 
                    type="number" 
                    min="0"
                    value={stock} 
                    onChange={(e) => setStock(e.target.value)} 
                    className="form-input" 
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? (
                    <>
                      <RefreshCw size={16} className="spinner" style={{ animation: "spin 1s linear infinite" }} /> Saving...
                    </>
                  ) : (
                    "Save Product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING NOTIFICATION TOASTS */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", display: "flex", flexDirection: "column", gap: "10px", zIndex: 1100 }}>
        {toasts.map((toast) => (
          <div key={toast.id} className="toast glass-panel" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", background: toast.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", borderColor: toast.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)" }}>
            {toast.type === "success" ? (
              <CheckCircle2 size={20} color="#34d399" />
            ) : (
              <AlertCircle size={20} color="#fca5a5" />
            )}
            <span style={{ fontSize: "14px", color: toast.type === "success" ? "#a7f3d0" : "#fee2e2" }}>{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
