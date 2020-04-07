import axios from 'axios';
import * as constants from './constants';
import { Photo, PhotoMap } from "./model/photo.interface";
import { CloudinaryCredentials } from "./model/cloudinary-credentials.interface";
import { CloudinaryPhoto } from "./model/cloudinary-photo.interface";

export default class CloudinaryMetadataApi {

	constructor(private readonly credentials: CloudinaryCredentials) {}

	/**
	 * Gets all photo data.
	 * Gets all tags, and then gets all photo data per tag.
	 */
	public async getAllPhotoData(): Promise<PhotoMap> {
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
		return axios.get(this.generateGetAllTagsUrl())
			.then(({ data: { tags } }) => tags);
	}

	/**
	 * Fetches all photo data for the given tag.
	 * Returns it in a new map of tag -> photo data.
	 */
	private async fetchPhotoDataByTag(tagName: string): Promise<PhotoMap> {
		const { data: { resources } } = await axios.get(this.generateGetPhotoDataForTagUrl(tagName));

		return {
			[tagName]: resources
				.filter((photo: CloudinaryPhoto) => !!photo)
				// Sort our photos based on their public ID
				.sort((a: CloudinaryPhoto, b: CloudinaryPhoto) => a.public_id.localeCompare(b.public_id))
				.map((photo: CloudinaryPhoto) => this.transformPhotoData(photo))
		};
	}

	/**
	 * Transforms our photo data.
	 * Converts thumbnail URL & photo URLs.
	 */
	private transformPhotoData(photo: CloudinaryPhoto): Photo {
		return {
			thumbnailUrl: this.generateThumbnailUrl(photo.public_id),
			photoUrl: this.generatePhotoUrl(photo.public_id)
		};
	}

	private generateBaseUrl(): string {
		return `https://${this.credentials.cloudinaryApiKey}:${this.credentials.cloudinaryApiSecret}@api.cloudinary.com/v1_1/${this.credentials.cloudinaryCloudName}`;
	}

	private generatePhotoUrl(publicId: string): string {
		return `https://res.cloudinary.com/${this.credentials.cloudinaryCloudName}/image/upload/${constants.CLOUDINARY_TRANSFORM_AUTO_FORMAT}/${publicId}`;
	}

	private generateThumbnailUrl(publicId: string): string {
		return `https://res.cloudinary.com/${this.credentials.cloudinaryCloudName}/image/upload/${constants.CLOUDINARY_TRANSFORM_THUMBNAIL},${constants.CLOUDINARY_TRANSFORM_AUTO_FORMAT}/${publicId}`;
	}

	private generateGetAllTagsUrl(): string {
		return `${this.generateBaseUrl()}${constants.URI_GET_ALL_TAGS}?${constants.PARAMETER_MAX_RESULTS}`
	}

	private generateGetPhotoDataForTagUrl(tagName: string): string {
		return `${this.generateBaseUrl()}${constants.URI_GET_PHOTO_DATA_FOR_TAG}/${tagName}?${constants.PARAMETER_MAX_RESULTS}`;
	}
}