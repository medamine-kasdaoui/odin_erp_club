import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LocationService {
    private readonly logger = new Logger(LocationService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {}

    /**
     * Geocode an address into latitude and longitude.
     */
    async geocode(address: string): Promise<{ lat: number; lon: number } | null> {
        const apiKey = this.configService.get<string>('LOCATIONIQ_API_KEY');
        if (!apiKey) {
            this.logger.warn('LOCATIONIQ_API_KEY is not defined');
            return null;
        }

        try {
            const url = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(address)}&format=json&limit=1`;
            const response = await firstValueFrom(this.httpService.get(url));
            const data = response.data;

            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon),
                };
            }
        } catch (error) {
            this.logger.error(`Geocoding failed for address "${address}": ${error.message}`);
        }
        return null;
    }

    /**
     * Calculate route between two coordinates using OSRM (via LocationIQ).
     * Returns travel time in seconds and distance in meters.
     */
    async getRoute(
        start: { lat: number; lon: number },
        end: { lat: number; lon: number },
    ): Promise<{ durationSeconds: number; distanceMeters: number; itineraryUrl: string; polyline?: string } | null> {
        const apiKey = this.configService.get<string>('LOCATIONIQ_API_KEY');
        if (!apiKey) return null;

        try {
            const url = `https://us1.locationiq.com/v1/directions/driving/${start.lon},${start.lat};${end.lon},${end.lat}?key=${apiKey}&overview=full&steps=true`;
            const response = await firstValueFrom(this.httpService.get(url));
            const data = response.data;

            if (data && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                return {
                    durationSeconds: Math.round(route.duration),
                    distanceMeters: Math.round(route.distance),
                    itineraryUrl: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${start.lat}%2C${start.lon}%3B${end.lat}%2C${end.lon}`,
                    polyline: route.geometry, // OSRM returns encoded polyline by default
                };
            }
        } catch (error) {
            this.logger.error(`Routing failed: ${error.message}`);
        }
        return null;
    }
}
