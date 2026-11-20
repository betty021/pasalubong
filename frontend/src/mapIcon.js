import L from 'leaflet';

// Pin icon na galing sa Font Awesome (walang larawan, kaya hindi nasisira sa Vite)
export const pinIcon = L.divIcon({
  className: 'pin-marker',
  html: '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
  iconSize: [34, 44],
  iconAnchor: [17, 42],   // dulo ng pin ang tumuturo sa lokasyon
});
