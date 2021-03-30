/**
 * Helpers to enable Immutable compatibility *without* bringing in
 * the 'immutable' package as a dependency.
 */

/**
 * Check if an object is immutable by checking if it has a key specific
 * to the immutable library.
 *
 * @param  {any} object
 * @return {bool}
 */
export function isImmutable(object) {
	return !!(
		object &&
		typeof object.hasOwnProperty === 'function' &&
		(object.hasOwnProperty('__ownerID') || // Immutable.Map
			(object._map && object._map.hasOwnProperty('__ownerID')))
	) // Immutable.Record
}
