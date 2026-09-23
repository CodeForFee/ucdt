export interface City {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { id: "hcmc", name: "TP. Hồ Chí Minh", lat: 10.7769, lng: 106.7009 },
  { id: "hanoi", name: "Hà Nội", lat: 21.0285, lng: 105.8542 },
  { id: "danang", name: "Đà Nẵng", lat: 16.0544, lng: 108.2022 },
  { id: "cantho", name: "Cần Thơ", lat: 10.0452, lng: 105.7469 },
  { id: "haiphong", name: "Hải Phòng", lat: 20.8449, lng: 106.6881 },
];

export const DEFAULT_CITY = CITIES[0];
