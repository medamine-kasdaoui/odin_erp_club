import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GeoLocation {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  type?: string;
}

export interface AirportInfo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

@Injectable()
export class GeoAiService {
  private readonly logger = new Logger(GeoAiService.name);
  private readonly photonBase = 'https://photon.komoot.io/api';

  constructor(private readonly httpService: HttpService) {}

  // ─── Géocoder une adresse → coordonnées GPS ────────────────────────────────
  async geocodeAddress(address: string, city?: string): Promise<GeoLocation | null> {
    try {
      const query = city ? `${address}, ${city}` : address;
      const response = await firstValueFrom(
        this.httpService.get(this.photonBase, {
          params: {
            q: query,
            limit: 1,
            lang: 'fr',
          },
        }),
      );

      if (!response.data?.features?.length) return null;
      const feature = response.data.features[0];
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      return {
        name: props.name || address,
        lat: coords[1], // Latitude est en 2ème position dans GeoJSON standard
        lng: coords[0], // Longitude est en 1ère position
        address: `${props.name || ''} ${props.city || ''} ${props.country || ''}`.trim(),
        type: props.osm_value,
      };
    } catch (error) {
      this.logger.warn(`Géocodage Photon échoué pour: ${address} — ${error.message}`);
      return null;
    }
  }

  // ─── Trouver les aéroports proches d'une ville ────────────────────────────
  async findAirportsNearCity(city: string, country?: string): Promise<AirportInfo[]> {
    try {
      const query = country ? `airport ${city} ${country}` : `airport ${city}`;
      const response = await firstValueFrom(
        this.httpService.get(this.photonBase, {
          params: {
            q: query,
            limit: 5,
            lang: 'fr',
          },
        }),
      );

      return (response.data?.features || [])
        .map((feature: any) => {
          const props = feature.properties;
          const coords = feature.geometry.coordinates;
          return {
            code: this.extractIATACode(props.name || '', city),
            name: props.name || 'Aéroport',
            lat: coords[1],
            lng: coords[0],
            city,
            country: props.country || country,
          };
        })
        .slice(0, 3);
    } catch (error) {
      this.logger.warn(`Aéroports Photon non trouvés pour: ${city}`);
      return [];
    }
  }

  // ─── Enrichir un voyage avec les données GPS automatiquement ──────────────
  async enrichTravelWithGeoData(destination: string, departureCity: string, hotelAddress: string) {
    // Attendre 1s entre chaque requête (respect rate limit Nominatim)
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const destinationGeo = await this.geocodeAddress(destination);
    await delay(1000);

    const departureAirports = await this.findAirportsNearCity(departureCity);
    await delay(1000);

    const arrivalAirports = await this.findAirportsNearCity(destination);
    await delay(1000);

    const hotelGeo = await this.geocodeAddress(hotelAddress, destination);

    return {
      destinationLat: destinationGeo?.lat,
      destinationLng: destinationGeo?.lng,
      departureAirport: departureAirports[0] ? {
        code: departureAirports[0].code,
        name: departureAirports[0].name,
        lat: departureAirports[0].lat,
        lng: departureAirports[0].lng,
      } : null,
      arrivalAirport: arrivalAirports[0] ? {
        code: arrivalAirports[0].code,
        name: arrivalAirports[0].name,
        lat: arrivalAirports[0].lat,
        lng: arrivalAirports[0].lng,
      } : null,
      hotelLat: hotelGeo?.lat,
      hotelLng: hotelGeo?.lng,
    };
  }

  // ─── Calculer la distance entre deux points GPS (km) ────────────────────
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // ─── Recherche générale (Photon Proxy) ────────────────────────────────────
  async searchPlaces(query: string, limit = 10): Promise<GeoLocation[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(this.photonBase, {
          params: { q: query, limit, lang: 'fr' },
        }),
      );

      return (response.data?.features || []).map((feature: any) => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        return {
          name: props.name || 'Lieu inconnu',
          lat: coords[1],
          lng: coords[0],
          address: `${props.name || ''} ${props.city || ''} ${props.country || ''}`.trim(),
          type: props.osm_value,
        };
      });
    } catch (error) {
      this.logger.error(`Erreur recherche Photon Proxy: ${error.message}`);
      return [];
    }
  }

  private toRad(deg: number): number { return deg * (Math.PI / 180); }

  private readonly knownAirports: Record<string, string> = {
    'tunis': 'TUN',
    'carthage': 'TUN',
    'paris': 'CDG',
    'beauvais': 'BVA',
    'düsseldorf': 'DUS',
    'dusseldorf': 'DUS',
    'madrid': 'MAD',
    'barcelon': 'BCN',
    'toronto': 'YYZ',
    'vancouver': 'YVR',
    'canada': 'YVR', // fallback simpliste
    'spain': 'MAD',
    'turku': 'TKU', // selon la capture d'écran
  };

  private extractIATACode(displayName: string, city: string = ''): string {
    // Extraire le code IATA s'il est dans le nom (ex: "Tunis-Carthage (TUN)")
    const match = displayName.match(/\(([A-Z]{3})\)/);
    if (match) return match[1];

    const searchStr = `${displayName} ${city}`.toLowerCase();
    for (const [key, code] of Object.entries(this.knownAirports)) {
      if (searchStr.includes(key)) {
        return code;
      }
    }
    return 'N/A';
  }
}
