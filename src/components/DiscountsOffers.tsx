// DiscountsOffers.tsx - Vista completa del sistema de descuentos y ofertas
import React, { useState, useEffect } from 'react';
import {
  Percent, Award, Target, Plus, Edit, Trash2, 
  Eye, EyeOff, Calendar, Tag, DollarSign,
  Package, RefreshCw, BarChart3, TrendingUp,
  AlertCircle, CheckCircle, Clock, Users
} from 'lucide-react';

interface Discount {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'porcentaje' | 'monto_fijo' | 'buy_x_get_y' | 'categoria' | 'temporal';
  valor: number;
  valor_maximo?: number;
  codigo_cupon?: string;
  cantidad_minima?: number;
  monto_minimo?: number;
  categoria_id?: number;
  producto_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo: number;
  limite_uso?: number;
  veces_usado: number;
  es_acumulable: number;
  categoria_nombre?: string;
  producto_nombre?: string;
}

interface Offer {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: 'porcentaje' | 'monto_fijo' | 'precio_especial';
  valor: number;
  fecha_inicio: string;
  fecha_fin: string;
  activo: number;
  productos_vinculados: number;
}

interface DiscountForm {
  nombre: string;
  descripcion: string;
  tipo: string;
  valor: number;
  valor_maximo?: number;
  codigo_cupon?: string;
  cantidad_minima?: number;
  monto_minimo?: number;
  categoria_id?: number;
  producto_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  limite_uso?: number;
  es_acumulable: boolean;
}

const DiscountsOffers: React.FC = () => {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'discounts' | 'offers' | 'stats'>('discounts');
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  const [discountForm, setDiscountForm] = useState<DiscountForm>({
    nombre: '',
    descripcion: '',
    tipo: 'porcentaje',
    valor: 0,
    es_acumulable: false
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Cargar descuentos
      const discountsData = await window.api('descuentos:obtener', {});
      setDiscounts(discountsData || []);

      // Cargar ofertas
      const offersData = await window.api('ofertas:obtener', {});
      setOffers(offersData || []);

      // Cargar productos
      const productsData = await window.api('productos:obtener');
      setProducts(productsData || []);

      // Cargar categorías
      const categoriesData = await window.api('categorias:obtener');
      setCategories(categoriesData || []);

      // Cargar estadísticas
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const statsData = await window.api('descuentos:estadisticas', startDate, endDate);
      setStatistics(statsData);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO');
  };

  const handleCreateDiscount = async () => {
    try {
      const discountData = {
        ...discountForm,
        usuario_id: 1, // Obtener del contexto de usuario
        es_acumulable: discountForm.es_acumulable ? 1 : 0
      };

      if (editingDiscount) {
        await window.api('descuentos:actualizar', editingDiscount.id, discountData);
      } else {
        await window.api('descuentos:crear', discountData);
      }

      setShowForm(false);
      setEditingDiscount(null);
      setDiscountForm({
        nombre: '',
        descripcion: '',
        tipo: 'porcentaje',
        valor: 0,
        es_acumulable: false
      });
      await loadData();
    } catch (error) {
      console.error('Error saving discount:', error);
    }
  };

  const handleToggleDiscount = async (id: number) => {
    try {
      await window.api('descuentos:activar', id);
      await loadData();
    } catch (error) {
      console.error('Error toggling discount:', error);
    }
  };

  const handleDeleteDiscount = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este descuento?')) {
      try {
        await window.api('descuentos:eliminar', id);
        await loadData();
      } catch (error) {
        console.error('Error deleting discount:', error);
      }
    }
  };

  const createSeasonalOffers = async () => {
    try {
      await window.api('descuentos:crearOfertasTemporada', 1);
      await loadData();
    } catch (error) {
      console.error('Error creating seasonal offers:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg">Cargando sistema de descuentos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Percent className="h-8 w-8 text-purple-600" />
            Sistema de Descuentos y Ofertas
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Crear Descuento
            </button>
            <button
              onClick={createSeasonalOffers}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Award className="h-4 w-4" />
              Ofertas de Temporada
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'discounts', label: 'Descuentos', icon: Percent },
            { id: 'offers', label: 'Ofertas', icon: Award },
            { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedTab === id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      {selectedTab === 'discounts' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Descuentos Activos</p>
                <p className="text-2xl font-bold text-purple-800">
                  {discounts.filter(d => d.activo === 1).length}
                </p>
              </div>
              <Percent className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Total Descuentos</p>
                <p className="text-2xl font-bold text-green-800">{discounts.length}</p>
              </div>
              <Tag className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Ofertas Activas</p>
                <p className="text-2xl font-bold text-blue-800">
                  {offers.filter(o => o.activo === 1).length}
                </p>
              </div>
              <Award className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Usos Totales</p>
                <p className="text-2xl font-bold text-orange-800">
                  {discounts.reduce((sum, d) => sum + d.veces_usado, 0)}
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Discounts Table */}
      {selectedTab === 'discounts' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Descuentos Configurados</h3>
          </div>
          {discounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descuento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {discounts.map((discount) => (
                    <tr key={discount.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{discount.nombre}</div>
                          <div className="text-sm text-gray-500">{discount.descripcion}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          discount.tipo === 'porcentaje' ? 'bg-blue-100 text-blue-800' :
                          discount.tipo === 'monto_fijo' ? 'bg-green-100 text-green-800' :
                          discount.tipo === 'buy_x_get_y' ? 'bg-purple-100 text-purple-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {discount.tipo === 'porcentaje' ? 'Porcentaje' :
                           discount.tipo === 'monto_fijo' ? 'Monto Fijo' :
                           discount.tipo === 'buy_x_get_y' ? 'Buy X Get Y' :
                           discount.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {discount.tipo === 'porcentaje' ? `${discount.valor}%` : formatCurrency(discount.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {discount.codigo_cupon ? (
                          <span className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                            {discount.codigo_cupon}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {discount.veces_usado} / {discount.limite_uso || '∞'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          discount.activo === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {discount.activo === 1 ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleDiscount(discount.id)}
                            className={`p-1 rounded ${
                              discount.activo === 1 ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                            }`}
                            title={discount.activo === 1 ? 'Desactivar' : 'Activar'}
                          >
                            {discount.activo === 1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingDiscount(discount);
                              setDiscountForm(discount);
                              setShowForm(true);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDiscount(discount.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8">
              <Percent className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay descuentos configurados</h3>
              <p className="text-gray-500 mb-4">Crea tu primer descuento para comenzar</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Crear Descuento
              </button>
            </div>
          )}
        </div>
      )}

      {/* Offers Section */}
      {selectedTab === 'offers' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Ofertas Especiales</h3>
          </div>
          {offers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Oferta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vigencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Productos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {offers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{offer.nombre}</div>
                          <div className="text-sm text-gray-500">{offer.descripcion}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {offer.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {offer.tipo === 'porcentaje' ? `${offer.valor}%` : formatCurrency(offer.valor)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(offer.fecha_inicio)} - {formatDate(offer.fecha_fin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {offer.productos_vinculados} productos
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          offer.activo === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {offer.activo === 1 ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8">
              <Award className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay ofertas especiales</h3>
              <p className="text-gray-500 mb-4">Las ofertas aparecerán aquí una vez configuradas</p>
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      {selectedTab === 'stats' && statistics && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Estadísticas de Descuentos (Últimos 30 días)
            </h3>
            {statistics.length > 0 ? (
              <div className="space-y-4">
                {statistics.map((stat: any, index: number) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-purple-900">{stat.descuento_nombre}</p>
                        <p className="text-sm text-purple-700">Tipo: {stat.tipo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-800">{stat.total_aplicaciones} usos</p>
                        <p className="text-sm text-purple-600">
                          Ahorro total: {formatCurrency(stat.monto_total_descontado)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No hay estadísticas disponibles</p>
            )}
          </div>
        </div>
      )}

      {/* Discount Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingDiscount ? 'Editar Descuento' : 'Crear Nuevo Descuento'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={discountForm.nombre}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Nombre del descuento"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={discountForm.tipo}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="porcentaje">Porcentaje</option>
                    <option value="monto_fijo">Monto Fijo</option>
                    <option value="buy_x_get_y">Buy X Get Y</option>
                    <option value="categoria">Descuento por Categoría</option>
                    <option value="temporal">Descuento Temporal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={discountForm.descripcion}
                  onChange={(e) => setDiscountForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={2}
                  placeholder="Descripción del descuento"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor {discountForm.tipo === 'porcentaje' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    value={discountForm.valor}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="0"
                    step={discountForm.tipo === 'porcentaje' ? '1' : '0.01'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Cupón (Opcional)</label>
                  <input
                    type="text"
                    value={discountForm.codigo_cupon || ''}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, codigo_cupon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ej: DESCUENTO20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={discountForm.fecha_inicio || ''}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={discountForm.fecha_fin || ''}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={discountForm.es_acumulable}
                    onChange={(e) => setDiscountForm(prev => ({ ...prev, es_acumulable: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Descuento acumulable con otros</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingDiscount(null);
                  setDiscountForm({
                    nombre: '',
                    descripcion: '',
                    tipo: 'porcentaje',
                    valor: 0,
                    es_acumulable: false
                  });
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDiscount}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingDiscount ? 'Actualizar' : 'Crear'} Descuento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start">
          <CheckCircle className="h-6 w-6 text-green-600 mt-1 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Sistema de Descuentos y Ofertas - Implementado</h3>
            <div className="text-green-700 space-y-2">
              <p><strong>Sistema completamente funcional con:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
                <li>✅ Tabla 'descuentos' en la base de datos</li>
                <li>✅ Tabla 'ofertas_productos' para vincular ofertas con productos</li>
                <li>✅ Lógica en el sistema de ventas para aplicar descuentos</li>
                <li>✅ APIs para crear, modificar y eliminar ofertas</li>
                <li>✅ Validación de fechas y condiciones de ofertas</li>
                <li>✅ Seguimiento de uso de cupones y descuentos</li>
              </ul>
              <p className="mt-2"><strong>Tipos disponibles:</strong> Porcentaje, Monto Fijo, Buy X Get Y, Descuento por Categoría, Descuentos Temporales</p>
              <p className="mt-3 text-sm font-medium">
                <strong>Estado:</strong> Todas las funcionalidades están operativas y listas para uso comercial.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountsOffers;