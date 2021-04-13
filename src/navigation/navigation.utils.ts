export const KEY_CODES = {
  MOUSE_LEFT: 1,
  MOUSE_RIGHT: 3,
  MOUSE_MIDDLE: 2,
  BACKSPACE: 8,
  COMMA: 188,
  INSERT: 45,
  DELETE: 46,
  END: 35,
  ENTER: 13,
  ESCAPE: 27,
  CONTROL: 17,
  COMMAND_LEFT: 91,
  COMMAND_RIGHT: 93,
  COMMAND_FIREFOX: 224,
  ALT: 18,
  HOME: 36,
  PAGE_DOWN: 34,
  PAGE_UP: 33,
  PERIOD: 190,
  SPACE: 32,
  SHIFT: 16,
  CAPS_LOCK: 20,
  TAB: 9,
  ARROW_RIGHT: 39,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
  A: 65,
  C: 67,
  D: 68,
  F: 70,
  L: 76,
  O: 79,
  P: 80,
  S: 83,
  V: 86,
  X: 88,
}

/**
 * Returns whether a given row coordinate is out of the given limit
 * @param index
 * @param min
 * @param max
 */
export function isIndexOutOfBoundaries(index: number, min: number, max: number) {
  return index < min || index > max
}

/**
 * Returns true if keyCode represents a printable character.
 *
 * @param {number} keyCode The keyboard key code.
 * @returns {boolean}
 */
export function isPrintableChar(keyCode: number) {
  return (
    keyCode === 32 || // space
    (keyCode >= 48 && keyCode <= 57) || // 0-9
    (keyCode >= 96 && keyCode <= 111) || // numpad
    (keyCode >= 186 && keyCode <= 192) || // ;=,-./`
    (keyCode >= 219 && keyCode <= 222) || // []{}\|"'
    keyCode >= 226 || // special chars (229 for Asian chars)
    (keyCode >= 65 && keyCode <= 90)
  ) // a-z
}

/**
 * Checks if passed key code is ctrl or cmd key.
 * Depends on what OS the code runs it check key code based on
 * different meta key codes.
 *
 * @param {number} keyCode The keyboard key code.
 * @returns {boolean}
 */
export function isCtrlKey(keyCode: number) {
  const keys: number[] = []

  //Ensure navigator is defined due to the fact this might be rendered on SSR
  if (navigator && navigator.platform.includes('Mac')) {
    keys.push(KEY_CODES.COMMAND_LEFT, KEY_CODES.COMMAND_RIGHT, KEY_CODES.COMMAND_FIREFOX)
  } else {
    keys.push(KEY_CODES.CONTROL)
  }

  return keys.includes(keyCode)
}

/**
 * Checks if passed key code is ctrl or cmd key.
 * This helper checks if the key code matches to meta keys
 * regardless of the OS on which it is running.
 *
 * @param {number} keyCode The keyboard key code.
 * @returns {boolean}
 */
export function isCtrlMetaKey(keyCode: number) {
  return [
    KEY_CODES.CONTROL,
    KEY_CODES.COMMAND_LEFT,
    KEY_CODES.COMMAND_RIGHT,
    KEY_CODES.COMMAND_FIREFOX,
  ].includes(keyCode)
}

/**
 * @param {number} keyCode The keyboard key code.
 * @param {string} baseCode The list of the key codes to compare with.
 * @returns {boolean}
 */
// export function isKey(keyCode, baseCode) {
// 	const keys = baseCode.split('|')
// 	let result = false
//
// 	arrayEach(keys, key => {
// 		if (keyCode === KEY_CODES[key]) {
// 			result = true
//
// 			return false
// 		}
// 	})
//
// 	return result
// }

/**
 * @param {number} keyCode The keyboard key code.
 * @returns {boolean}
 */
export function isMetaKey(keyCode: number) {
  const metaKeys = [
    KEY_CODES.ARROW_DOWN,
    KEY_CODES.ARROW_UP,
    KEY_CODES.ARROW_LEFT,
    KEY_CODES.ARROW_RIGHT,
    KEY_CODES.HOME,
    KEY_CODES.END,
    KEY_CODES.DELETE,
    KEY_CODES.BACKSPACE,
    KEY_CODES.F1,
    KEY_CODES.F2,
    KEY_CODES.F3,
    KEY_CODES.F4,
    KEY_CODES.F5,
    KEY_CODES.F6,
    KEY_CODES.F7,
    KEY_CODES.F8,
    KEY_CODES.F9,
    KEY_CODES.F10,
    KEY_CODES.F11,
    KEY_CODES.F12,
    KEY_CODES.TAB,
    KEY_CODES.PAGE_DOWN,
    KEY_CODES.PAGE_UP,
    KEY_CODES.ENTER,
    KEY_CODES.ESCAPE,
    KEY_CODES.SHIFT,
    KEY_CODES.CAPS_LOCK,
    KEY_CODES.ALT,
  ]

  return metaKeys.indexOf(keyCode) !== -1
}
