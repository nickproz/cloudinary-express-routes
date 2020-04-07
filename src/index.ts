import axios from 'axios';
import * as constants from './constants';
import NodeCache = require("node-cache");
import { Photo, PhotoMap } from "./model/photo.interface";

export default class CloudinaryCacheAPI {

	private readonly cloudinaryCache: NodeCache;

	constructor(
		private readonly cloudinaryApiKey: string,
		private readonly cloudinaryApiSecret: string,
		private readonly cloudinaryCloudName: string,
		private readonly cacheTimeToLiveSeconds: number = constants.CACHE_TIME_TO_LIVE_SECONDS
	) {
		this.cloudinaryCache = new NodeCache({ stdTTL: cacheTimeToLiveSeconds, checkperiod: cacheTimeToLiveSeconds / 10 });
	}

	/**
	 * Clears the cache for the API.
	 */
	public clearCache(): void {
		this.cloudinaryCache.flushAll();
	}

	/**
	 * Gets all photo data.
	 * Gets all tags, and then gets all photo data per tag.
	 */
	public async getAllPhotoData(): Promise<PhotoMap> {
		let photoData: PhotoMap|undefined = this.cloudinaryCache.get(constants.CACHE_KEY_PHOTO_DATA);

		// If the cache didn't return anything, re-fetch it
		if(!photoData) {
			// Fetch all photo data for each tag and concatenate them
			photoData = await this.fetchAllPhotoData();

			// Save our photo data to the cache
			this.cloudinaryCache.set(constants.CACHE_KEY_PHOTO_DATA, photoData);
		}

		return photoData;
	}

	/**
	 * Fetches all photo data from Cloudinary.
	 */
	private async fetchAllPhotoData(): Promise<PhotoMap> {
		// Fetch all tags
		const tags: string[] = await this.fetchAllTags();

		// Fetch all photo data for each tag and concatenate them
		return Promise.all(tags.map((tag: string) => this.fetchPhotoDataByTag(tag)))
			.then((data: PhotoMap[]) => Object.assign({}, ...data));
	}

	/**
	 * Fetches all tags.
	 */
	private fetchAllTags(): Promise<string[]> {
		return axios.get(this.generateGetAllTagsUrl()).then(({ data: { tags } }) => tags);
	}

	/**
	 * Fetches all photo data for the given tag.
	 * Returns it in a new map of tag -> photo data.
	 */
	private async fetchPhotoDataByTag(tagName: string): Promise<PhotoMap> {
		const { data: { resources } } = await axios.get(this.generateGetPhotoDataForTagUrl(tagName));

		return {
			[tagName]: resources
				.filter((photo: any) => !!photo)
				// Sort our photos based on their public ID
				.sort((a: any, b: any) => a.public_id.localeCompare(b.public_id))
				.map((photo: any) => this.transformPhotoData(photo))
		};
	}

	/**
	 * Transforms our photo data.
	 * Converts thumbnail URL & photo URLs.
	 */
	private transformPhotoData(photo: any): Photo {
		return {
			thumbnailUrl: this.generateThumbnailUrl(photo.public_id),
			photoUrl: this.generatePhotoUrl(photo.public_id)
		};
	}

	private generateBaseUrl(): string {
		return `https://${this.cloudinaryApiKey}:${this.cloudinaryApiSecret}@api.cloudinary.com/v1_1/${this.cloudinaryCloudName}`;
	}

	private generatePhotoUrl(publicId: string): string {
		return `https://res.cloudinary.com/${this.cloudinaryCloudName}/image/upload/${constants.CLOUDINARY_TRANSFORM_AUTO_FORMAT}/${publicId}`;
	}

	private generateThumbnailUrl(publicId: string): string {
		return `https://res.cloudinary.com/${this.cloudinaryCloudName}/image/upload/${constants.CLOUDINARY_TRANSFORM_THUMBNAIL},${constants.CLOUDINARY_TRANSFORM_AUTO_FORMAT}/${publicId}`;
	}

	private generateGetAllTagsUrl(): string {
		return `${this.generateBaseUrl()}${constants.URI_GET_ALL_TAGS}?${constants.PARAMETER_MAX_RESULTS}`
	}

	private generateGetPhotoDataForTagUrl(tagName: string): string {
		return `${this.generateBaseUrl()}${constants.URI_GET_PHOTO_DATA_FOR_TAG}/${tagName}?${constants.PARAMETER_MAX_RESULTS}`;
	}
}