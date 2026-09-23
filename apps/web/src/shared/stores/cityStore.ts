import { create } from "zustand";
import { CITIES, DEFAULT_CITY, type City } from "@/shared/constants/cities";

interface CityState {
  selectedCity: City;
  cities: City[];
  setCity: (city: City) => void;
  setCityById: (id: string) => void;
}

export const useCityStore = create<CityState>((set) => ({
  selectedCity: DEFAULT_CITY,
  cities: CITIES,
  setCity: (city) => set({ selectedCity: city }),
  setCityById: (id) => {
    const city = CITIES.find((c) => c.id === id);
    if (city) set({ selectedCity: city });
  },
}));
