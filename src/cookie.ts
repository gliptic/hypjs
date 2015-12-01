export function encode(bytes: ArrayBuffer, out: Uint8Array) {
	var bitBuf = 0, bits = 0, b = 0, o = 0;
	var view = new DataView(bytes);
	var group;

	while (b + 3 < bytes.byteLength) {
		group = view.getUint32(b);
		b += 4;

		out[o++] = (group % 85) | 0; group = (group / 85) | 0;
		out[o++] = (group % 85) | 0; group = (group / 85) | 0;
		out[o++] = (group % 85) | 0; group = (group / 85) | 0;
		out[o++] = (group % 85) | 0;
	}


}

for (var i = 1;; ++i) {
	// groups of i digits
	var capacityPerGroup = Math.log(Math.pow(80, i)) / Math.log(2);
	var usedPerGroup = Math.floor(capacityPerGroup);
	var storedPerGroup = i * 8;

	if (usedPerGroup > 48)
		break;

	console.log('Groups of', i, ', efficiency:', (usedPerGroup / storedPerGroup), ', used per group:', usedPerGroup);
}