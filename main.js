// Markers LatLng
const markersLatLng = [
    [54.3610063, 18.549947],
    [54.0, 18.0],
    [53.0, 19.0],
];

const foo = L.latLngBounds(markersLatLng);
// console.log(foo.getCenter());

const map = L.map("map", {
    center: [54.3610063, 18.549947], // lat, lng
    zoom: 10,
    //   maxBounds: markersLatLng,
});

// Event listeners
const logEventType = (e) => console.log('EVENT: ', e.type);
const handleLocationFound = (e) => {
    logEventType(e);
    console.log(e);
};
map.on("load", logEventType);
map.on("viewreset", logEventType);
map.on("layeradd", logEventType);
map.on("moveend", logEventType);
map.on('locationfound', handleLocationFound);

const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
});

layer.on("tileloadstart", () => {
    console.log(111);
});

const markers = markersLatLng.map((markerLatLng) => L.marker(markerLatLng));

markers.forEach((marker) => {
    map.addLayer(marker);
});

map.addLayer(layer);

setTimeout(() => {
    map.fitBounds(foo, {
    });
}, 3000);

setTimeout(() => {
    map.locate({
        setView: true,
    });
    console.log(map.getPixelBounds());
}, 5000);

console.log(map.getPixelOrigin());
console.log(map.getPixelBounds());
console.log(map.getPixelWorldBounds());
console.log(layer)