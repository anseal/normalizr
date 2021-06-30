export function cloneWithJSON(data: any): any {
	return JSON.parse(JSON.stringify(data))
}
export function deepEqualWithJSON(data1: any, data2: any): boolean {
	return JSON.stringify(data1) === JSON.stringify(data2)
}

export function clonePOJO(data: any): any {
	if( Array.isArray(data) ) {
		return data.map(clonePOJO) as any
	}
	if( typeof data === 'object' ) {
		if( data === null ) {
			return null
		}

		const copy: any = {}
		for(const key in data) {
			copy[key] = clonePOJO(data[key])
		}
		return copy as any
	}
	return data
}

export function deepEqualSameShape(data1: any, data2: any): boolean {
	if( Array.isArray(data1) ) {
		if( Array.isArray(data2) === false ) {
			return false
		}
		if( data1.length !== data2.length ) {
			return false
		}
		for( let i = 0 ; i !== data1.length ; ++i ) {
			if( deepEqualSameShape(data1[i], data2[i]) === false ) {
				return false
			}
		}
		return true
	}
	if( typeof data1 === 'object' ) {
		if( typeof data2 !== 'object' ) {
			return false
		}
		if( data1 === null ) {
			if( data2 !== null ) {
				return false
			}
			return true
		}

		const keys1 = Object.keys(data1)
		const keys2 = Object.keys(data2)
		if( keys1.length !== keys2.length ) return false
		for( let i = 0 ; i !== keys1.length ; ++i ) {
			if( keys1[i] !== keys2[i] ) {
				return false
			}
		}
		for(const key of keys1) {
			if( deepEqualSameShape(data1[key], data2[key]) === false ) {
				return false
			}
		}
		return true
	}
	return data1 === data2 || Number.isNaN(data1) === Number.isNaN(data2)
}
