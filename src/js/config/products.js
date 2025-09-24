export const PRODUCT_CATALOG = {
  descongel: {
    name: 'Descongel x100 cápsulas',
    icon: '❄️',
    className: 'descongel',
    color: '#0ca678'
  },
  multidol400: {
    name: 'Multidol 400mg',
    icon: '💊',
    className: 'multidol400',
    color: '#4c6ef5'
  },
  multidol800: {
    name: 'Multidol 800mg',
    icon: '💊',
    className: 'multidol800',
    color: '#d6336c'
  }
};

export function getProductOptions() {
  return Object.entries(PRODUCT_CATALOG).map(([value, meta]) => ({
    value,
    label: meta.name,
    icon: meta.icon
  }));
}
