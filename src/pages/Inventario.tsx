// Inventario.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../services/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { useProducts, useCategories, Product, Category } from '../services/DatabaseService';
import {
  Search, Pencil, Trash2, Plus, Package, BarChart4,
  AlertCircle, ArrowUpDown, RotateCcw, X, AlertTriangle,
  Check, Loader, Barcode, QrCode, Printer, ChevronLeft, Filter, SlidersHorizontal,
  ShieldCheck, Settings
} from 'lucide-react';
import { useOptimizedProductSync, useOptimizedInventorySync } from '../hooks/useOptimizedSync';
import { broadcastSyncEvent } from '../services/SyncService';
import SmoothUpdateIndicator from '../components/SmoothUpdateIndicator';

// Tipo para alerta
type AlertType = 'success' | 'warning' | 'error' | 'info';

const Inventario = () => {
  // const { user, hasPermission } = useAuth();
  const { products, loading, error: productsError, fetchProducts, addProduct, updateProduct, deleteProduct } = useProducts();
  const { categories, loading: loadingCategories, fetchCategories, addCategory, updateCategory, deleteCategory } = useCategories();
  
  // Crear estado local de productos para optimizar actualizaciones
  const [localProducts, setLocalProducts] = useState(products);
  
  // Sincronización entre múltiples ventanas de inventario y ventas
  useEffect(() => {
    if (!window.api?.registerSyncListener) return;

    const handleSyncEvent = (event: any) => {
      const syncEvent = event.detail || event;
      
      // 1. Escuchar actualizaciones de stock desde otras ventanas de inventario
      if (syncEvent.type === 'inventory:stock-updated') {
        const { productId, newStock, productData } = syncEvent.data;
        
        console.log('🔄 Received stock update from another window:', productId, newStock);
        
        // Actualizar solo el producto específico de forma suave
        setLocalProducts(prev => prev.map(product => {
          if (product.id === productId && product.stock !== newStock) {
            const stockChange = newStock - (product.stock || 0);
            return {
              ...product,
              stock: newStock,
              _stockUpdated: true,
              _stockChange: stockChange,
              _stockAnimation: stockChange > 0 ? 'increase' : stockChange < 0 ? 'decrease' : 'neutral',
              _updateTimestamp: Date.now(),
              _isRemoteUpdate: true // Flag para distinguir updates remotos
            };
          }
          return product;
        }));

        // Limpiar flags después de animación
        setTimeout(() => {
          setLocalProducts(prev => prev.map(product => 
            product.id === productId
              ? { 
                  ...product, 
                  _stockUpdated: false, 
                  _stockChange: undefined,
                  _stockAnimation: undefined,
                  _isRemoteUpdate: false
                }
              : product
          ));
        }, 2500);
      }
      
      // 2. Escuchar ventas desde la caja para actualizar stock
      if (syncEvent.type === 'sale' && syncEvent.data.action === 'create' && syncEvent.data.data.products) {
        console.log('🛒 Received sale from Caja - updating inventory:', syncEvent.data.data.products);
        
        // Actualizar stock para cada producto vendido
        syncEvent.data.data.products.forEach((saleItem: {id: number, quantity: number}) => {
          setLocalProducts(prev => prev.map(product => {
            if (product.id === saleItem.id) {
              const oldStock = Number(product.stock) || 0;
              const newStock = Math.max(0, oldStock - saleItem.quantity);
              const stockChange = newStock - oldStock;
              
              return {
                ...product,
                stock: newStock,
                _stockUpdated: true,
                _stockChange: stockChange,
                _stockAnimation: 'decrease',
                _updateTimestamp: Date.now(),
                _isRemoteUpdate: true
              };
            }
            return product;
          }));
        });
        
        // Limpiar flags después de animación
        setTimeout(() => {
          setLocalProducts(prev => prev.map(product => {
            const wasUpdated = syncEvent.data.data.products.some((item: any) => item.id === product.id);
            return wasUpdated
              ? { 
                  ...product, 
                  _stockUpdated: false, 
                  _stockChange: undefined,
                  _stockAnimation: undefined,
                  _isRemoteUpdate: false
                }
              : product;
          }));
        }, 2500);
      }
    };

    // Registrar listener para eventos de sync
    window.addEventListener('sync-event', handleSyncEvent as EventListener);
    window.api.registerSyncListener();

    return () => {
      window.removeEventListener('sync-event', handleSyncEvent as EventListener);
      if (window.api?.unregisterSyncListener) {
        window.api.unregisterSyncListener();
      }
    };
  }, []);
  
  // Sincronizar productos cuando cambien desde el hook de database
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Estados locales
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showLowStock, setShowLowStock] = useState(false);
  const [sortField, setSortField] = useState<'nombre' | 'categoria' | 'precio_venta' | 'stock'>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sidePanel, setSidePanel] = useState<'closed' | 'add' | 'edit' | 'addCategory' | 'editCategory'>('closed');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Estado para precios con y sin impuestos
  const [showsWithTax, setShowsWithTax] = useState(true);

  // Estado para categorías
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState<string>('');

  // Formulario de producto
  const [productForm, setProductForm] = useState<Product & { precio_sin_itbis?: number }>({
    nombre: '',
    codigo_barra: '',
    categoria: 'General',
    precio_venta: 0,
    precio_sin_itbis: 0,
    costo: 0,
    stock: 0,
    stock_minimo: 5,
    itebis: 0.18
  });

  // Función para formatear moneda
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);

  // Resetear el formulario
  const resetForm = () => {
    setProductForm({
      nombre: '',
      codigo_barra: '',
      categoria: 'General',
      precio_venta: 0,
      precio_sin_itbis: 0,
      costo: 0,
      stock: 0,
      stock_minimo: 5,
      itebis: 0.18
    });
    setImagePreview(null);
    setImageFile(null);
  };

  // Cargar producto en el formulario para editar
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);

    // Calcular precio sin ITBIS si el producto tiene ITBIS
    let precioSinITBIS;
    
    // Si es un producto exento (ITBIS = 0), ambos precios son iguales
    if (product.itebis === 0) {
      precioSinITBIS = product.precio_venta;
    } else {
      // Si tiene ITBIS, calcular el precio base
      precioSinITBIS = product.precio_venta / (1 + product.itebis);
    }

    setProductForm({
      ...product,
      precio_sin_itbis: precioSinITBIS
    });

    setImagePreview(product.imagen || null);
    setSidePanel('edit');
  };

  // Preparar para agregar nuevo producto
  const handleAddNewProduct = () => {
    resetForm();
    setSidePanel('add');
  };

  // Función para manejar la carga de imagen
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      // Crear vista previa
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Función para eliminar la imagen
  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFile(null);

    // Si estamos editando, asignar null a la imagen del producto
    if (sidePanel === 'edit') {
      setProductForm({
        ...productForm,
        imagen: undefined
      });
    }
  };

  // Regresar al home
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  // Filtrar y ordenar productos
  const filteredProducts = useMemo(() => {
    // Filtro básico - solo productos que existen
    let result = localProducts.filter(product => product && product.id);

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.nombre.toLowerCase().includes(term) ||
        (product.codigo_barra && product.codigo_barra.toLowerCase().includes(term))
      );
    }

    // Filtrar por categoría
    if (filterCategory && filterCategory !== 'All') {
      result = result.filter(product => product.categoria === filterCategory);
    }

    // Filtrar productos con bajo stock
    if (showLowStock) {
      result = result.filter(product =>
        product.stock <= (product.stock_minimo || 5)
      );
    }

    // Ordenar productos
    result.sort((a, b) => {
      // Inicializar con valores predeterminados para evitar undefined
      let aValue: string | number = "";
      let bValue: string | number = "";

      if (sortField === "nombre") {
        aValue = a.nombre?.toLowerCase() || "";
        bValue = b.nombre?.toLowerCase() || "";
      } else if (sortField === "categoria") {
        aValue = a.categoria?.toLowerCase() || "";
        bValue = b.categoria?.toLowerCase() || "";
      } else if (sortField === "precio_venta") {
        aValue = a.precio_venta || 0;
        bValue = b.precio_venta || 0;
      } else if (sortField === "stock") {
        aValue = a.stock || 0;
        bValue = b.stock || 0;
      }

      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      return 0;
    });

    return result;
  }, [localProducts, searchTerm, filterCategory, showLowStock, sortField, sortDirection]);

  // Estadísticas del inventario
  const stats = useMemo(() => {
    if (loading) return { total: 0, lowStock: 0, value: 0 };

    const lowStockCount = localProducts.filter(p => p.stock <= (p.stock_minimo || 5)).length;
    const totalValue = localProducts.reduce((sum, p) => sum + (p.stock * p.costo), 0);

    return {
      total: localProducts.length,
      lowStock: lowStockCount,
      value: totalValue
    };
  }, [localProducts, loading]);

  // Manejar cambios en el formulario
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    // Convertir valores numéricos
    if (type === 'number') {
      // Tratar específicamente el caso cuando itebis es "0" o "0.0"
      if (name === 'itebis') {
        // Asegurarse de que tanto "0" como "0.0" se manejen como 0
        const isZero = value === '0' || value === '0.0' || parseFloat(value) === 0;
        const numericValue = isZero ? 0 : (parseFloat(value) || 0);

        if (numericValue === 0) {
          // Para productos exentos, el precio base = precio de venta
          setProductForm({
            ...productForm,
            itebis: 0, // Asegurarse de que sea exactamente 0
            precio_sin_itbis: productForm.precio_venta,
            precio_venta: productForm.precio_venta
          });
        } else {
          // Si se está agregando ITBIS, recalcular el precio base
          const precioSinITBIS = productForm.precio_venta / (1 + numericValue);
          
          setProductForm({
            ...productForm,
            itebis: numericValue,
            precio_sin_itbis: precioSinITBIS,
            precio_venta: productForm.precio_venta // Mantener el precio final
          });
        }
      } else if (name === 'precio_sin_itbis') {
        const numericValue = parseFloat(value) || 0;
        // Si cambia el precio sin ITBIS
        const precioConITBIS = Number(productForm.itebis) === 0
          ? numericValue // Si está exento, precio final = precio base
          : numericValue * (1 + productForm.itebis);
        
        setProductForm({
          ...productForm,
          precio_sin_itbis: numericValue,
          precio_venta: precioConITBIS
        });
      } else if (name === 'precio_venta') {
        const numericValue = parseFloat(value) || 0;
        // Si cambia el precio con ITBIS
        const precioSinITBIS = Number(productForm.itebis) === 0
          ? numericValue // Si está exento, precio base = precio final
          : numericValue / (1 + productForm.itebis);
        
        setProductForm({
          ...productForm,
          precio_venta: numericValue,
          precio_sin_itbis: precioSinITBIS
        });
      } else {
        // Para otros campos numéricos
        const numericValue = parseFloat(value) || 0;
        setProductForm({ ...productForm, [name]: numericValue });
      }
    } else {
      // Para campos no numéricos
      setProductForm({ ...productForm, [name]: value });
    }
  };

  // Manejar el cambio de ordenamiento
  const handleSort = (field: 'nombre' | 'categoria' | 'precio_venta' | 'stock') => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Buscar por código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeInput.trim()) return;

    // Asegurarse de que código de barras se maneje como string
    const foundProduct = localProducts.find((p) => p.codigo_barra === barcodeInput.trim());

    if (foundProduct) {
      handleEditProduct(foundProduct);
    } else {
      setAlert({
        type: 'warning',
        message: `No existe un producto con el código ${barcodeInput}`
      });
      setTimeout(() => setAlert(null), 5000);
    }
    setBarcodeInput("");
  };

  // Guardar producto (crear o actualizar)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.nombre) {
      setAlert({ type: 'error', message: 'El nombre del producto es obligatorio' });
      return;
    }

    if (productForm.precio_venta <= 0) {
      setAlert({ type: 'error', message: 'El precio de venta debe ser mayor a 0' });
      return;
    }

    if (productForm.costo <= 0) {
      setAlert({ type: 'error', message: 'El costo debe ser mayor a 0' });
      return;
    }

    if (productForm.precio_venta <= productForm.costo) {
      setAlert({ type: 'warning', message: 'El precio de venta debe ser mayor al costo' });
      return;
    }

    setActionLoading(true);

    try {
      // Eliminar el campo precio_sin_itbis del formulario
      const { precio_sin_itbis, ...productToSave } = productForm;

      // Asegurarse de que el valor de ITBIS se respeta, especialmente si es 0
      const updatedProduct = {
        ...productToSave,
        itebis: productForm.itebis, // Asegurar que se guarde el valor exacto de ITBIS
        // Para productos exentos, asegurar que precio_venta es correcto y nunca undefined
        precio_venta: productForm.itebis === 0 ? (productForm.precio_sin_itbis || 0) : (productForm.precio_venta || 0)
      };

      // Aquí procesamos la imagen si se subió una nueva
      let updatedProductForm = { ...updatedProduct };

      if (imageFile) {
        // Convertir imagen a base64
        const reader = new FileReader();
        const imageBase64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(imageFile);
        });

        const imageBase64 = await imageBase64Promise;
        updatedProductForm.imagen = imageBase64;
      } else if (imagePreview === null && sidePanel === 'edit') {
        // Si se quitó la imagen en modo edición
        updatedProductForm.imagen = undefined;
      }

      let result;
      if (sidePanel === 'add') {
        // Crear nuevo producto
        result = await addProduct(updatedProductForm);
        setAlert({ type: 'success', message: 'Producto agregado con éxito' });
      } else {
        // Actualizar producto existente
        if (selectedProduct?.id) {
          result = await updateProduct(selectedProduct.id, updatedProductForm);
          setAlert({ type: 'success', message: 'Producto actualizado con éxito' });
        }
      }

      // Broadcast the change
      if (result) {
        const eventType = sidePanel === 'add' ? 'product:created' : 'product:updated';
        broadcastSyncEvent(eventType, { 
          id: result.id,
          productId: result.id, 
          product: result 
        });
      }

      // Cerrar el panel y resetear el formulario
      setSidePanel('closed');
      resetForm();
      setSelectedProduct(null);

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
      setAlert({
        type: 'error',
        message: `Error al ${sidePanel === 'add' ? 'agregar' : 'actualizar'} producto: ${err instanceof Error ? err.message : 'Error desconocido'}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Actualizar Stock - versión simple y segura
  const handleUpdateStock = async (productId: number | undefined, newStock: number) => {
    if (!productId || newStock < 0 || actionLoading) return;

    try {
      setActionLoading(true);
      const productToUpdate = localProducts.find(p => p.id === productId);
      if (!productToUpdate) {
        console.error('Product not found for stock update:', productId);
        return;
      }

      console.log('🔄 Updating stock for product:', { id: productId, currentStock: productToUpdate.stock, newStock });

      // 1. Actualización inmediata local (sin _isRemoteUpdate para evitar icono 🔄)
      setLocalProducts(prev => prev.map(product => {
        if (product.id === productId) {
          const stockChange = newStock - (product.stock || 0);
          return { 
            ...product, 
            stock: newStock,
            _stockUpdated: true,
            _stockChange: stockChange,
            _stockAnimation: stockChange > 0 ? 'increase' : stockChange < 0 ? 'decrease' : 'neutral',
            _updateTimestamp: Date.now()
            // NO _isRemoteUpdate porque es una actualización local
          };
        }
        return product;
      }));

      // 2. Actualizar en base de datos
      await updateProduct(productId, { stock: newStock });
      
      // 3. Refrescar desde DB pero sin mostrar animaciones (ya las mostramos)
      await fetchProducts();
      
      // 4. Limpiar flags después de animación
      setTimeout(() => {
        setLocalProducts(prev => prev.map(product => 
          product.id === productId
            ? { 
                ...product, 
                _stockUpdated: false, 
                _stockChange: undefined,
                _stockAnimation: undefined 
              }
            : product
        ));
      }, 2000);
      
      // Emitir evento de sincronización para otras ventanas
      if (window.api?.broadcastSyncEvent) {
        window.api.broadcastSyncEvent({
          type: 'inventory:stock-updated',
          data: {
            productId,
            newStock,
            productData: { ...productToUpdate, stock: newStock }
          },
          timestamp: Date.now()
        });
      }

    } catch (err) {
      console.error('Error updating stock:', err);
      setAlert({
        type: 'error',
        message: `Error al actualizar stock: ${err instanceof Error ? err.message : 'Error desconocido'}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Eliminar producto
  const handleDeleteProduct = async (id: number | undefined) => {
    if (!id) return;

    showConfirmDialog(
      'Eliminar producto',
      '¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.',
      async () => {
        try {
          await deleteProduct(id);
          setAlert({ type: 'success', message: 'Producto eliminado con éxito' });
          await fetchProducts();
        } catch (err) {
          setAlert({
            type: 'error',
            message: `Error al eliminar producto: ${err instanceof Error ? err.message : 'Error desconocido'}`
          });
        }
      },
      'danger'
    );
  };

  // Funciones para categorías
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setAlert({ type: 'error', message: 'El nombre de la categoría es obligatorio' });
      return;
    }
    
    try {
      setActionLoading(true);
      
      // Verificar si la categoría ya existe
      const categoryExists = categories.some(
        cat => cat.nombre.toLowerCase() === newCategoryName.trim().toLowerCase()
      );
      
      if (categoryExists) {
        setAlert({ type: 'error', message: 'Ya existe una categoría con este nombre' });
        setActionLoading(false);
        return;
      }
      
      // Crear la categoría
      await addCategory({
        nombre: newCategoryName.trim(),
        descripcion: categoryDescription.trim() || undefined
      });
      
      // Actualizar las categorías
      await fetchCategories();
      
      setAlert({ type: 'success', message: 'Categoría agregada con éxito' });
      setNewCategoryName('');
      setCategoryDescription('');
      setSidePanel('closed');
      
      // Actualizar el filtro para mostrar la nueva categoría
      setFilterCategory(newCategoryName.trim());
      
    } catch (err) {
      console.error('Error al agregar categoría:', err);
      setAlert({
        type: 'error',
        message: `Error al agregar categoría: ${err instanceof Error ? err.message : 'Error desconocido'}`
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditCategory = (categoryName: string) => {
    setEditingCategory(categoryName);
    setNewCategoryName(categoryName);
    setCategoryDescription('');
    setSidePanel('editCategory');
  };

  const handleSaveEditedCategory = async () => {
    if (!newCategoryName.trim()) {
      setAlert({ type: 'error', message: 'El nombre de la categoría es obligatorio' });
      return;
    }

    try {
      const category = categories.find(c => c.nombre === editingCategory);
      if (category && category.id) {
        await updateCategory(category.id, {
          nombre: newCategoryName.trim(),
          descripcion: categoryDescription.trim() || category.descripcion
        });

        // Actualizar las categorías
        await fetchCategories();

        setAlert({ type: 'success', message: 'Categoría actualizada con éxito' });
        setNewCategoryName('');
        setCategoryDescription('');
        setSidePanel('closed');
        setFilterCategory(newCategoryName.trim());
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: `Error al actualizar categoría: ${err instanceof Error ? err.message : 'Error desconocido'}`
      });
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    if (!categoryName || categoryName === 'All' || categoryName === 'General') {
      setAlert({ type: 'error', message: 'No se puede eliminar esta categoría' });
      return;
    }

    showConfirmDialog(
      'Eliminar categoría',
      `¿Estás seguro de eliminar la categoría ${categoryName}? Los productos en esta categoría quedarán sin categoría asignada.`,
      async () => {
        try {
          const category = categories.find(c => c.nombre === categoryName);
          if (category && category.id) {
            await deleteCategory(category.id);
            setAlert({ type: 'success', message: 'Categoría eliminada con éxito' });
            setFilterCategory('All');
          }
        } catch (err) {
          setAlert({
            type: 'error',
            message: `Error al eliminar categoría: ${err instanceof Error ? err.message : 'Error desconocido'}`
          });
        }
      },
      'danger'
    );
  };

  // Efecto para cerrar la alerta después de un tiempo
  // Load printers on mount
  useEffect(() => {
    loadPrinters();
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Load available printers
  const loadPrinters = async () => {
    try {
      setLoadingPrinters(true);
      const result = await window.printApi?.getPrinters();
      
      if (result?.success) {
        setPrinters(result.printers || []);
        
        // Set default printer
        const defaultPrinter = result.printers?.find((p: any) => p.isDefault);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.name);
        }
      }
    } catch (error) {
      console.error('Error loading printers:', error);
    } finally {
      setLoadingPrinters(false);
    }
  };

  // Test printer function
  const handleTestPrinter = async () => {
    if (!selectedPrinter) {
      setAlert({ type: 'warning', message: 'Por favor selecciona una impresora' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await window.printApi?.testPrinter(selectedPrinter);
      
      if (result?.success) {
        setAlert({ type: 'success', message: 'Prueba de impresora enviada correctamente' });
      } else {
        throw new Error(result?.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: `Error al probar impresora: ${(err as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate product label HTML
  const generateProductLabelHTML = (product: Product): string => {
    const currency = 'RD$'; // You can get this from settings if available
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 8px; 
            margin: 0;
            background: white;
            width: 62mm;
            height: 40mm;
          }
          .label {
            border: 2px solid #000;
            padding: 6px;
            text-align: center;
            height: 36mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .product-name {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.2;
          }
          .barcode-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px 0;
          }
          .barcode {
            max-width: 100%;
            max-height: 100%;
          }
          .product-info {
            font-size: 8px;
            color: #333;
          }
          .product-code {
            font-size: 8px;
            margin: 1px 0;
            color: #666;
          }
          .product-price {
            font-size: 12px;
            font-weight: bold;
            color: #d00;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="product-name" title="${product.nombre}">${product.nombre}</div>
          
          ${product.codigo_barra ? `
            <div class="barcode-container">
              <canvas id="barcode" class="barcode"></canvas>
            </div>
            <div class="product-code">${product.codigo_barra}</div>
          ` : ''}
          
          <div class="product-price">${currency} ${product.precio_venta.toFixed(2)}</div>
          <div class="product-info">Stock: ${product.stock}</div>
        </div>

        ${product.codigo_barra ? `
          <script>
            try {
              JsBarcode("#barcode", "${product.codigo_barra}", {
                format: "CODE128",
                width: 1,
                height: 30,
                displayValue: false,
                margin: 0,
                fontSize: 8
              });
            } catch(e) {
              console.error('Error generating barcode:', e);
              document.getElementById('barcode').style.display = 'none';
            }
          </script>
        ` : ''}
      </body>
      </html>
    `;
  };

  // Generate custom barcode HTML
  const generateCustomBarcodeHTML = (text: string): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 10px;
            background: white;
            text-align: center;
          }
          .barcode-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100px;
          }
          .barcode {
            margin: 10px 0;
          }
          .barcode-text {
            margin-top: 10px;
            font-size: 14px;
            font-weight: bold;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="barcode-container">
          <canvas id="barcode" class="barcode"></canvas>
          <div class="barcode-text">${text}</div>
        </div>

        <script>
          try {
            JsBarcode("#barcode", "${text}", {
              format: "CODE128",
              width: 2,
              height: 100,
              displayValue: true,
              fontSize: 14,
              margin: 10
            });
          } catch(e) {
            console.error('Error generating barcode:', e);
            document.body.innerHTML = '<p>Error al generar código de barras</p>';
          }
        </script>
      </body>
      </html>
    `;
  };

  // Generate custom QR code HTML
  const generateCustomQRHTML = (text: string): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 10px;
            background: white;
            text-align: center;
          }
          .qr-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 200px;
          }
          .qr-code {
            margin: 10px 0;
          }
          .qr-text {
            margin-top: 10px;
            font-size: 12px;
            word-break: break-all;
            max-width: 200px;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          <canvas id="qrcode" class="qr-code"></canvas>
          <div class="qr-text">${text}</div>
        </div>

        <script>
          try {
            QRCode.toCanvas(document.getElementById('qrcode'), "${text}", {
              width: 200,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            }, function (error) {
              if (error) {
                console.error(error);
                document.body.innerHTML = '<p>Error al generar código QR</p>';
              }
            });
          } catch(e) {
            console.error('Error generating QR code:', e);
            document.body.innerHTML = '<p>Error al generar código QR</p>';
          }
        </script>
      </body>
      </html>
    `;
  };

  // Print functions
  const handlePrint = async () => {
    if (!selectedPrinter) {
      setAlert({ type: 'warning', message: 'Por favor selecciona una impresora' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      let html = '';
      let result;

      switch (printPanel.type) {
        case 'label':
          if (!printPanel.product) throw new Error('No hay producto seleccionado');
          html = generateProductLabelHTML(printPanel.product);
          result = await window.printApi?.printEtiqueta(html, selectedPrinter);
          break;
        
        case 'custom-barcode':
          if (!customBarcodeText.trim()) {
            setAlert({ type: 'warning', message: 'Por favor ingresa texto para el código de barras' });
            return;
          }
          html = generateCustomBarcodeHTML(customBarcodeText);
          result = await window.printApi?.printBarcode(html, selectedPrinter);
          break;
        
        case 'custom-qr':
          if (!customQRText.trim()) {
            setAlert({ type: 'warning', message: 'Por favor ingresa texto para el código QR' });
            return;
          }
          html = generateCustomQRHTML(customQRText);
          result = await window.printApi?.printQR(html, selectedPrinter);
          break;
        
        default:
          throw new Error('Tipo de impresión no válido');
      }
      
      if (result?.success) {
        setAlert({ type: 'success', message: 'Impreso correctamente' });
        // Close panel and reset
        setPrintPanel({ isOpen: false, product: null, type: 'label' });
        setCustomBarcodeText('');
        setCustomQRText('');
      } else {
        throw new Error(result?.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: `Error al imprimir: ${(err as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminado: Sistema de notificaciones problemático que causaba mensajes incorrectos

  // Componentes reutilizables
  interface StatCardProps {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    value: string | number;
    color?: string;
    isLoading?: boolean;
  }

  const StatCard = ({ icon: Icon, title, value, color = "blue", isLoading = false }: StatCardProps) => (
    <div className="bg-white p-4 rounded-xl shadow-md flex items-center">
      <div className={`p-3 rounded-full mr-4 bg-${color}-100`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      <div>
        <h3 className="text-gray-500 text-sm">{title}</h3>
        {isLoading ? (
          <div className="h-6 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
        ) : (
          <p className="text-xl font-semibold">{value}</p>
        )}
      </div>
    </div>
  );

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  const Alert = ({ type, message }: { type: AlertType; message: string }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: AlertCircle }
    };

    const style = colors[type] || colors.info;
    const Icon = style.icon;

    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg flex items-start mb-4`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{message}</div>
        <button onClick={() => setAlert(null)} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Enhanced state for print panel with barcode/QR functionality
  const [printPanel, setPrintPanel] = useState<{ 
    isOpen: boolean; 
    product: Product | null;
    type: 'label' | 'barcode' | 'qr' | 'custom-barcode' | 'custom-qr';
  }>({
    isOpen: false,
    product: null,
    type: 'label'
  });
  const [printQuantity, setPrintQuantity] = useState<number>(1);
  const [customBarcodeText, setCustomBarcodeText] = useState('');
  const [customQRText, setCustomQRText] = useState('');
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labelSize, setLabelSize] = useState('1.57x1.18');

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alerta */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert type={alert.type} message={alert.message} />
        </div>
      )}

      {/* Error de productos */}
      {productsError && (
        <div className="bg-red-50 p-4 rounded-md border border-red-200 mb-4">
          <p className="text-red-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {productsError}
          </p>
        </div>
      )}

      {/* Encabezado */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Inventario</h1>
          </div>
        </div>
        <button
          className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
          onClick={handleAddNewProduct}
        >
          <Plus className="h-4 w-4" />
          Agregar Producto
        </button>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 px-6 pb-8">
        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            icon={Package}
            title="Total de Productos"
            value={stats.total.toString()}
            color="blue"
            isLoading={loading}
          />
          <StatCard
            icon={AlertTriangle}
            title="Productos con Bajo Stock"
            value={stats.lowStock.toString()}
            color="yellow"
            isLoading={loading}
          />
          <StatCard
            icon={BarChart4}
            title="Valor del Inventario"
            value={formatCurrency(stats.value)}
            color="green"
            isLoading={loading}
          />
        </div>

        {/* Buscador y lector de código */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                className="pl-9 py-2 px-4 rounded-lg border border-gray-200 w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow">
                <Barcode className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Escanear código..."
                  className="pl-9 py-2 px-4 rounded-lg border border-gray-200 w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Buscar
              </button>
            </form>
          </div>
        </div>

        {/* Printing Tools Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Herramientas de Impresión</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setPrintPanel({ isOpen: true, product: null, type: 'custom-barcode' })}
              className="flex items-center gap-2 py-2 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
            >
              <Barcode className="h-4 w-4" />
              <span>Código de Barras Personalizado</span>
            </button>
            <button
              onClick={() => setPrintPanel({ isOpen: true, product: null, type: 'custom-qr' })}
              className="flex items-center gap-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <QrCode className="h-4 w-4" />
              <span>Código QR Personalizado</span>
            </button>
          </div>
        </div>

        {/* Filtros y opciones */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm">
          <div className="flex flex-wrap gap-3 w-full">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="py-2 px-4 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
            >
              <option value="All">Todas las categorías</option>
              {Array.isArray(categories) && categories.length > 0 ? (
                categories.map((cat, index) => (
                  <option key={cat.id || `cat-filter-${index}`} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))
              ) : (
                <option value="General">General</option>
              )}
            </select>

            {filterCategory !== 'All' && (
              <div className="flex gap-2">
                <button
                  className="py-2 px-4 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  onClick={() => handleEditCategory(filterCategory)}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="py-2 px-4 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => handleDeleteCategory(filterCategory)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              className="py-2 px-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              onClick={() => setSidePanel('addCategory')}
            >
              Agregar Categoría
            </button>

            <div className="flex items-center ml-auto">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLowStock}
                  onChange={() => setShowLowStock(!showLowStock)}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition ${showLowStock ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${showLowStock ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="ml-2 text-sm">Mostrar productos con bajo stock</span>
              </label>
            </div>
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center p-10">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="ml-2 text-gray-500">Cargando productos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col justify-center items-center p-10">
              <Package className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500">No se encontraron productos</p>
              <button
                className="mt-4 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={handleAddNewProduct}
              >
                Agregar Producto
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imagen
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('nombre')}
                    >
                      <div className="flex items-center gap-1">
                        Nombre
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'nombre' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('categoria')}
                    >
                      <div className="flex items-center gap-1">
                        Categoría
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'categoria' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('precio_venta')}
                    >
                      <div className="flex items-center gap-1">
                        Precio
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'precio_venta' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center gap-1">
                        Stock
                        <ArrowUpDown className={`h-4 w-4 ${sortField === 'stock' ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ITBIS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código de Barras
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product, index) => (
                      <tr key={product.id || `product-${index}`} className={`hover:bg-gray-50 transition-colors ${product._isDeleting ? 'animate-fade-out opacity-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold overflow-hidden">
                          {product.imagen ? (
                            <img src={product.imagen} alt={product.nombre} className="h-full w-full object-cover" />
                          ) : (
                            (product.nombre || 'N').charAt(0)
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">{product.nombre || 'Sin nombre'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                          {product.categoria || "Sin categoría"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {formatCurrency(Number(product.precio_venta) || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              const currentStock = Number(product.stock) || 0;
                              if (currentStock > 0) handleUpdateStock(product.id, currentStock - 1);
                            }}
                            disabled={(Number(product.stock) || 0) <= 0 || actionLoading}
                          >
                            -
                          </button>
                          <div className="relative">
                            <span className={`
                              w-12 text-center font-medium transition-all duration-500 ease-out block transform
                              ${(product.stock || 0) <= (product.stock_minimo || 5) ? "text-red-500" : "text-gray-700"}
                              ${product._stockUpdated ? 'scale-125 font-bold shadow-md' : 'scale-100'}
                              ${product._stockAnimation === 'increase' ? 'text-green-600 bg-green-50 rounded-md px-2 py-1' : ''}
                              ${product._stockAnimation === 'decrease' ? 'text-red-600 bg-red-50 rounded-md px-2 py-1' : ''}
                              ${product._isRemoteUpdate ? 'ring-2 ring-blue-300 ring-opacity-50 bg-blue-50 rounded-md px-2 py-1' : ''}
                            `}>
                              {product.stock || 0}
                            </span>
                            
                            {/* Indicador de cambio de stock mejorado */}
                            {product._stockChange && product._stockUpdated && (
                              <span className={`
                                absolute -top-1 -right-1 text-xs font-bold px-2 py-1 rounded-full z-10
                                transition-all duration-300 ease-out animate-bounce
                                ${product._stockChange > 0 
                                  ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                                  : 'bg-red-500 text-white shadow-lg shadow-red-200'
                                }
                                ${product._isRemoteUpdate ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                              `}>
                                {product._stockChange > 0 ? '+' : ''}{product._stockChange}
                              </span>
                            )}
                            
                            {/* Indicador de update remoto - solo para ventas o otras ventanas */}
                            {product._isRemoteUpdate && (
                              <span className="absolute -top-2 -left-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full animate-pulse">
                                🔄
                              </span>
                            )}
                          </div>
                          <button
                            className="flex items-center justify-center h-8 w-8 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              const currentStock = Number(product.stock) || 0;
                              handleUpdateStock(product.id, currentStock + 1);
                            }}
                            disabled={actionLoading}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${
                          ((Number(product.precio_venta) || 0) - (Number(product.costo) || 0)) / (Number(product.costo) || 1) * 100 > 20 
                            ? "text-green-600" : "text-red-600"
                        }`}>
                          {(Number(product.precio_venta) > 0 && Number(product.costo) > 0) 
                            ? (((Number(product.precio_venta) - Number(product.costo)) / Number(product.costo)) * 100).toFixed(2)
                            : '0.00'
                          }%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.itebis === 0 ? (
                          <span className="inline-flex items-center text-green-600 text-xs font-medium">
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Exento
                          </span>
                        ) : (
                          <span>{((Number(product.itebis) || 0) * 100).toFixed(0)}%</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        <div className="flex items-center gap-2">
                          <Barcode className="h-4 w-4 text-gray-400" />
                          <span className="font-mono text-xs">{product.codigo_barra || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditProduct(product)}
                            title="Editar producto"
                            className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="text-sm font-medium">Editar</span>
                          </button>

                          <button
                            onClick={() => setPrintPanel({ isOpen: true, product, type: 'label' })}
                            title="Imprimir etiquetas"
                            className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="text-sm font-medium">Imprimir</span>
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            title="Eliminar producto"
                            className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Eliminar</span>
                          </button>
                        </div>
                      </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Panel lateral para agregar/editar producto */}
      {(sidePanel === 'add' || sidePanel === 'edit') && (
        <div className="fixed inset-0 backdrop-blur-sm z-30 flex justify-end pointer-events-auto transition-all duration-300 animate-fadeIn">
          <div
            onClick={() => setSidePanel('closed')}
            className="absolute inset-0 animate-fadeIn"
          ></div>
          <div className="bg-white w-full max-w-md h-[calc(100vh-64px)] mt-16 overflow-y-auto shadow-xl rounded-l-2xl relative z-10 animate-slideIn">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-gray-800">
                  {sidePanel === 'add' ? 'Agregar Producto' : 'Editar Producto'}
                </h2>
                <button
                  onClick={() => setSidePanel('closed')}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <form onSubmit={handleSaveProduct}>
                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Producto
                    </label>
                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      required
                      value={productForm.nombre}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* ITBIS */}
                  <div>
                    <label htmlFor="itebis" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      ITBIS (%)
                      {Number(productForm.itebis) === 0 && (
                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                          Producto Exento
                        </span>
                      )}
                    </label>
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-grow">
                        <input
                          id="itebis"
                          name="itebis"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={productForm.itebis}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          id="isExempt"
                          type="checkbox"
                          checked={Number(productForm.itebis) === 0}
                          onChange={(e) => {
                            const event = {
                              target: {
                                name: 'itebis',
                                value: e.target.checked ? '0.0' : '0.18',
                                type: 'number'
                              }
                            } as React.ChangeEvent<HTMLInputElement>;
                            
                            handleFormChange(event);
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isExempt" className="ml-2 block text-sm text-gray-700">
                          Exento
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Valor entre 0 y 1. Por ejemplo: 0.18 para 18% (0 para productos exentos)
                    </p>
                  </div>

                  {/* Precio y Costo */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="precio_sin_itbis" className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Base (sin ITBIS)
                      </label>
                      <input
                        id="precio_sin_itbis"
                        name="precio_sin_itbis"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={productForm.precio_sin_itbis}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="precio_venta" className="block text-sm font-medium text-gray-700 mb-1">
                        Precio de Venta (con ITBIS)
                      </label>
                      <input
                        id="precio_venta"
                        name="precio_venta"
                        type="number"
                        step="0.01"
                        min="0"
                        value={productForm.precio_venta}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                        readOnly
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Este precio incluye ITBIS y es el que verá el cliente
                      </p>
                    </div>
                    <div>
                      <label htmlFor="costo" className="block text-sm font-medium text-gray-700 mb-1">
                        Costo
                      </label>
                      <input
                        id="costo"
                        name="costo"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={productForm.costo}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Margen calculado */}
                  {productForm.precio_venta > 0 && productForm.costo > 0 && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm">
                        Margen:
                        <span className={((productForm.precio_venta - productForm.costo) / productForm.costo) * 100 > 20 ? " text-green-600" : " text-red-600"}>
                          {' '}{(((productForm.precio_venta - productForm.costo) / productForm.costo) * 100).toFixed(2)}%
                        </span>
                        <span className="text-gray-600 ml-2">
                          ({formatCurrency(productForm.precio_venta - productForm.costo)})
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Categoría */}
                  <div>
                    <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría
                    </label>
                    <select
                      id="categoria"
                      name="categoria"
                      value={productForm.categoria || ''}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleccione una categoría</option>
                      {Array.isArray(categories) && categories.length > 0 ? (
                        categories.map((cat, index) => (
                          <option key={cat.id || `cat-form-${index}`} value={cat.nombre}>
                            {cat.nombre}
                          </option>
                        ))
                      ) : (
                        <option value="General">General</option>
                      )}
                    </select>
                  </div>

                  {/* Stock */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Actual
                      </label>
                      <input
                        id="stock"
                        name="stock"
                        type="number"
                        min="0"
                        value={productForm.stock}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="stock_minimo" className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Mínimo
                      </label>
                      <input
                        id="stock_minimo"
                        name="stock_minimo"
                        type="number"
                        min="0"
                        value={productForm.stock_minimo}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Código de barras */}
                  <div>
                    <label htmlFor="codigo_barra" className="block text-sm font-medium text-gray-700 mb-1">
                      Código de Barras
                    </label>
                    <input
                      id="codigo_barra"
                      name="codigo_barra"
                      type="text"
                      value={productForm.codigo_barra || ''}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Soporta códigos de barras largos (EAN-13, UPC, etc.)
                    </p>
                  </div>

                  {/* Imagen del producto */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Imagen del Producto (opcional)
                    </label>
                    <div className="mt-1 flex items-center space-x-4">
                      {imagePreview ? (
                        <div className="relative">
                          <div className="h-24 w-24 rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={imagePreview}
                              alt="Vista previa"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute -top-2 -right-2 bg-red-100 rounded-full p-1 text-red-600 hover:bg-red-200"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 cursor-pointer"
                          onClick={() => document.getElementById('producto-imagen')?.click()}>
                          <Package className="h-8 w-8 mb-1" />
                          <span className="text-xs">Subir imagen</span>
                        </div>
                      )}

                      <input
                        id="producto-imagen"
                        name="imagen"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />

                      <div className="text-xs text-gray-500">
                        <p>Formatos: JPG, PNG, GIF</p>
                        <p>Tamaño máximo: 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setSidePanel('closed')}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-3"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {actionLoading ? (
                        <div className="flex items-center">
                          <Loader className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </div>
                      ) : (
                        'Guardar'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Panel lateral para agregar categoría */}
      {sidePanel === 'addCategory' && (
        <div className="fixed inset-0 backdrop-blur-sm z-30 flex justify-end pointer-events-auto transition-all duration-300 animate-fadeIn">
          <div 
            onClick={() => setSidePanel('closed')}
            className="absolute inset-0 animate-fadeIn"
          ></div>
          <div className="bg-white w-full max-w-md h-[calc(100vh-64px)] mt-16 overflow-y-auto shadow-xl rounded-l-2xl relative z-10 animate-slideIn">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-gray-800">
                  Agregar Categoría
                </h2>
                <button 
                  onClick={() => setSidePanel('closed')} 
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="newCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Categoría
                  </label>
                  <input
                    id="newCategoryName"
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    id="categoryDescription"
                    rows={3}
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setSidePanel('closed')}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {actionLoading ? (
                      <div className="flex items-center">
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </div>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel lateral para editar categoría */}
      {sidePanel === 'editCategory' && (
        <div className="fixed inset-0 backdrop-blur-sm z-30 flex justify-end pointer-events-auto transition-all duration-300 animate-fadeIn">
          <div 
            onClick={() => setSidePanel('closed')}
            className="absolute inset-0 animate-fadeIn"
          ></div>
          <div className="bg-white w-full max-w-md h-[calc(100vh-64px)] mt-16 overflow-y-auto shadow-xl rounded-l-2xl relative z-10 animate-slideIn">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-gray-800">
                  Editar Categoría
                </h2>
                <button 
                  onClick={() => setSidePanel('closed')} 
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="editCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Categoría
                  </label>
                  <input
                    id="editCategoryName"
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="editCategoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    id="editCategoryDescription"
                    rows={3}
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setSidePanel('closed')}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedCategory}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {actionLoading ? (
                      <div className="flex items-center">
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </div>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Print Panel with Barcode/QR functionality */}
      {printPanel.isOpen && (
        <div className="fixed inset-0 backdrop-blur-sm z-30 flex justify-end">
          <div
            onClick={() => setPrintPanel({ isOpen: false, product: null, type: 'label' })}
            className="absolute inset-0"
          />
          <div className="bg-white w-full max-w-md h-[calc(100vh-64px)] mt-16 shadow-xl rounded-l-2xl relative z-10 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {printPanel.type === 'label' && printPanel.product && `Etiqueta - ${printPanel.product.nombre}`}
                {printPanel.type === 'custom-barcode' && 'Código de Barras Personalizado'}
                {printPanel.type === 'custom-qr' && 'Código QR Personalizado'}
              </h2>
              <button
                onClick={() => setPrintPanel({ isOpen: false, product: null, type: 'label' })}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Product information for label printing */}
              {printPanel.type === 'label' && printPanel.product && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">{printPanel.product.nombre}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>Código: {printPanel.product.codigo_barra || 'Sin código'}</div>
                    <div>Precio: {formatCurrency(printPanel.product.precio_venta)}</div>
                    <div>Stock: {printPanel.product.stock}</div>
                    <div>Categoría: {printPanel.product.categoria || 'Sin categoría'}</div>
                  </div>
                </div>
              )}

              {/* Custom barcode text input */}
              {printPanel.type === 'custom-barcode' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto del código de barras:
                  </label>
                  <input
                    type="text"
                    value={customBarcodeText}
                    onChange={(e) => setCustomBarcodeText(e.target.value)}
                    placeholder="Ej: 1234567890123"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Custom QR text input */}
              {printPanel.type === 'custom-qr' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto o URL:
                  </label>
                  <input
                    type="text"
                    value={customQRText}
                    onChange={(e) => setCustomQRText(e.target.value)}
                    placeholder="Ej: https://miempresa.com o texto libre"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Label size selection (only for product labels) */}
              {printPanel.type === 'label' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tamaño de Etiqueta
                  </label>
                  <select
                    value={labelSize}
                    onChange={(e) => setLabelSize(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="1.57x1.18">1.57" × 1.18" (40mm × 30mm)</option>
                    <option value="1.96x1.18">1.96" × 1.18" (50mm × 30mm)</option>
                    <option value="1.57x2.76">1.57" × 2.76" (40mm × 70mm)</option>
                    <option value="1.96x1.57">1.96" × 1.57" (50mm × 40mm)</option>
                    <option value="1.96x3.14">1.96" × 3.14" (50mm × 80mm)</option>
                  </select>
                </div>
              )}

              {/* Quantity selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={printQuantity}
                  onChange={e => setPrintQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Printer selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Impresora:
                </label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  disabled={loadingPrinters}
                >
                  <option value="">
                    {loadingPrinters ? 'Cargando...' : 'Seleccionar impresora...'}
                  </option>
                  {printers.map(printer => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview section */}
              <div className="text-center p-4 border border-gray-200 rounded-lg bg-gray-50">
                {printPanel.type === 'label' && <Package className="h-16 w-16 mx-auto text-gray-400 mb-2" />}
                {printPanel.type === 'custom-barcode' && <Barcode className="h-16 w-16 mx-auto text-gray-400 mb-2" />}
                {printPanel.type === 'custom-qr' && <QrCode className="h-16 w-16 mx-auto text-gray-400 mb-2" />}
                <p className="text-sm text-gray-500">Vista previa de impresión</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleTestPrinter}
                  disabled={!selectedPrinter || isSubmitting}
                  className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span>Probar</span>
                </button>
                
                <button
                  onClick={handlePrint}
                  disabled={
                    !selectedPrinter || 
                    isSubmitting ||
                    (printPanel.type === 'custom-barcode' && !customBarcodeText.trim()) ||
                    (printPanel.type === 'custom-qr' && !customQRText.trim())
                  }
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span>{isSubmitting ? 'Imprimiendo...' : 'Imprimir'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default Inventario;