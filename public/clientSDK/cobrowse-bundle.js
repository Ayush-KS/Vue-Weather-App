(function (root, factory) {
  if (typeof exports === "object") {
    // CommonJS
    module.exports = exports = factory();
  } else if (typeof define === "function" && define.amd) {
    // AMD
    define([], factory);
  } else {
    // Global (browser)
    root.CryptoJS = factory();
  }
})(this, function () {
  /*globals window, global, require*/

  /**
   * CryptoJS core components.
   */
  var CryptoJS =
    CryptoJS ||
    (function (Math, undefined) {
      var crypto;

      // Native crypto from window (Browser)
      if (typeof window !== "undefined" && window.crypto) {
        crypto = window.crypto;
      }

      // Native (experimental IE 11) crypto from window (Browser)
      if (!crypto && typeof window !== "undefined" && window.msCrypto) {
        crypto = window.msCrypto;
      }

      // Native crypto from global (NodeJS)
      if (!crypto && typeof global !== "undefined" && global.crypto) {
        crypto = global.crypto;
      }

      // Native crypto import via require (NodeJS)
      if (!crypto && typeof require === "function") {
        try {
          crypto = require("crypto");
        } catch (err) {}
      }

      /*
       * Cryptographically secure pseudorandom number generator
       *
       * As Math.random() is cryptographically not safe to use
       */
      var cryptoSecureRandomInt = function () {
        if (crypto) {
          // Use getRandomValues method (Browser)
          if (typeof crypto.getRandomValues === "function") {
            try {
              return crypto.getRandomValues(new Uint32Array(1))[0];
            } catch (err) {}
          }

          // Use randomBytes method (NodeJS)
          if (typeof crypto.randomBytes === "function") {
            try {
              return crypto.randomBytes(4).readInt32LE();
            } catch (err) {}
          }
        }

        throw new Error(
          "Native crypto module could not be used to get secure random number."
        );
      };

      /*
	     * Local polyfill of Object.create

	     */
      var create =
        Object.create ||
        (function () {
          function F() {}

          return function (obj) {
            var subtype;

            F.prototype = obj;

            subtype = new F();

            F.prototype = null;

            return subtype;
          };
        })();

      /**
       * CryptoJS namespace.
       */
      var C = {};

      /**
       * Library namespace.
       */
      var C_lib = (C.lib = {});

      /**
       * Base object for prototypal inheritance.
       */
      var Base = (C_lib.Base = (function () {
        return {
          /**
           * Creates a new object that inherits from this object.
           *
           * @param {Object} overrides Properties to copy into the new object.
           *
           * @return {Object} The new object.
           *
           * @static
           *
           * @example
           *
           *     var MyType = CryptoJS.lib.Base.extend({
           *         field: 'value',
           *
           *         method: function () {
           *         }
           *     });
           */
          extend: function (overrides) {
            // Spawn
            var subtype = create(this);

            // Augment
            if (overrides) {
              subtype.mixIn(overrides);
            }

            // Create default initializer
            if (!subtype.hasOwnProperty("init") || this.init === subtype.init) {
              subtype.init = function () {
                subtype.$super.init.apply(this, arguments);
              };
            }

            // Initializer's prototype is the subtype object
            subtype.init.prototype = subtype;

            // Reference supertype
            subtype.$super = this;

            return subtype;
          },

          /**
           * Extends this object and runs the init method.
           * Arguments to create() will be passed to init().
           *
           * @return {Object} The new object.
           *
           * @static
           *
           * @example
           *
           *     var instance = MyType.create();
           */
          create: function () {
            var instance = this.extend();
            instance.init.apply(instance, arguments);

            return instance;
          },

          /**
           * Initializes a newly created object.
           * Override this method to add some logic when your objects are created.
           *
           * @example
           *
           *     var MyType = CryptoJS.lib.Base.extend({
           *         init: function () {
           *             // ...
           *         }
           *     });
           */
          init: function () {},

          /**
           * Copies properties into this object.
           *
           * @param {Object} properties The properties to mix in.
           *
           * @example
           *
           *     MyType.mixIn({
           *         field: 'value'
           *     });
           */
          mixIn: function (properties) {
            for (var propertyName in properties) {
              if (properties.hasOwnProperty(propertyName)) {
                this[propertyName] = properties[propertyName];
              }
            }

            // IE won't copy toString using the loop above
            if (properties.hasOwnProperty("toString")) {
              this.toString = properties.toString;
            }
          },

          /**
           * Creates a copy of this object.
           *
           * @return {Object} The clone.
           *
           * @example
           *
           *     var clone = instance.clone();
           */
          clone: function () {
            return this.init.prototype.extend(this);
          },
        };
      })());

      /**
       * An array of 32-bit words.
       *
       * @property {Array} words The array of 32-bit words.
       * @property {number} sigBytes The number of significant bytes in this word array.
       */
      var WordArray = (C_lib.WordArray = Base.extend({
        /**
         * Initializes a newly created word array.
         *
         * @param {Array} words (Optional) An array of 32-bit words.
         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.create();
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
         */
        init: function (words, sigBytes) {
          words = this.words = words || [];

          if (sigBytes != undefined) {
            this.sigBytes = sigBytes;
          } else {
            this.sigBytes = words.length * 4;
          }
        },

        /**
         * Converts this word array to a string.
         *
         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
         *
         * @return {string} The stringified word array.
         *
         * @example
         *
         *     var string = wordArray + '';
         *     var string = wordArray.toString();
         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
         */
        toString: function (encoder) {
          return (encoder || Hex).stringify(this);
        },

        /**
         * Concatenates a word array to this word array.
         *
         * @param {WordArray} wordArray The word array to append.
         *
         * @return {WordArray} This word array.
         *
         * @example
         *
         *     wordArray1.concat(wordArray2);
         */
        concat: function (wordArray) {
          // Shortcuts
          var thisWords = this.words;
          var thatWords = wordArray.words;
          var thisSigBytes = this.sigBytes;
          var thatSigBytes = wordArray.sigBytes;

          // Clamp excess bits
          this.clamp();

          // Concat
          if (thisSigBytes % 4) {
            // Copy one byte at a time
            for (var i = 0; i < thatSigBytes; i++) {
              var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
              thisWords[(thisSigBytes + i) >>> 2] |=
                thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
            }
          } else {
            // Copy one word at a time
            for (var i = 0; i < thatSigBytes; i += 4) {
              thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
            }
          }
          this.sigBytes += thatSigBytes;

          // Chainable
          return this;
        },

        /**
         * Removes insignificant bits.
         *
         * @example
         *
         *     wordArray.clamp();
         */
        clamp: function () {
          // Shortcuts
          var words = this.words;
          var sigBytes = this.sigBytes;

          // Clamp
          words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
          words.length = Math.ceil(sigBytes / 4);
        },

        /**
         * Creates a copy of this word array.
         *
         * @return {WordArray} The clone.
         *
         * @example
         *
         *     var clone = wordArray.clone();
         */
        clone: function () {
          var clone = Base.clone.call(this);
          clone.words = this.words.slice(0);

          return clone;
        },

        /**
         * Creates a word array filled with random bytes.
         *
         * @param {number} nBytes The number of random bytes to generate.
         *
         * @return {WordArray} The random word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.random(16);
         */
        random: function (nBytes) {
          var words = [];

          for (var i = 0; i < nBytes; i += 4) {
            words.push(cryptoSecureRandomInt());
          }

          return new WordArray.init(words, nBytes);
        },
      }));

      /**
       * Encoder namespace.
       */
      var C_enc = (C.enc = {});

      /**
       * Hex encoding strategy.
       */
      var Hex = (C_enc.Hex = {
        /**
         * Converts a word array to a hex string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The hex string.
         *
         * @static
         *
         * @example
         *
         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var hexChars = [];
          for (var i = 0; i < sigBytes; i++) {
            var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            hexChars.push((bite >>> 4).toString(16));
            hexChars.push((bite & 0x0f).toString(16));
          }

          return hexChars.join("");
        },

        /**
         * Converts a hex string to a word array.
         *
         * @param {string} hexStr The hex string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
         */
        parse: function (hexStr) {
          // Shortcut
          var hexStrLength = hexStr.length;

          // Convert
          var words = [];
          for (var i = 0; i < hexStrLength; i += 2) {
            words[i >>> 3] |=
              parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
          }

          return new WordArray.init(words, hexStrLength / 2);
        },
      });

      /**
       * Latin1 encoding strategy.
       */
      var Latin1 = (C_enc.Latin1 = {
        /**
         * Converts a word array to a Latin1 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Latin1 string.
         *
         * @static
         *
         * @example
         *
         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var latin1Chars = [];
          for (var i = 0; i < sigBytes; i++) {
            var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            latin1Chars.push(String.fromCharCode(bite));
          }

          return latin1Chars.join("");
        },

        /**
         * Converts a Latin1 string to a word array.
         *
         * @param {string} latin1Str The Latin1 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
         */
        parse: function (latin1Str) {
          // Shortcut
          var latin1StrLength = latin1Str.length;

          // Convert
          var words = [];
          for (var i = 0; i < latin1StrLength; i++) {
            words[i >>> 2] |=
              (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
          }

          return new WordArray.init(words, latin1StrLength);
        },
      });

      /**
       * UTF-8 encoding strategy.
       */
      var Utf8 = (C_enc.Utf8 = {
        /**
         * Converts a word array to a UTF-8 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The UTF-8 string.
         *
         * @static
         *
         * @example
         *
         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
         */
        stringify: function (wordArray) {
          try {
            return decodeURIComponent(escape(Latin1.stringify(wordArray)));
          } catch (e) {
            throw new Error("Malformed UTF-8 data");
          }
        },

        /**
         * Converts a UTF-8 string to a word array.
         *
         * @param {string} utf8Str The UTF-8 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
         */
        parse: function (utf8Str) {
          return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
        },
      });

      /**
       * Abstract buffered block algorithm template.
       *
       * The property blockSize must be implemented in a concrete subtype.
       *
       * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
       */
      var BufferedBlockAlgorithm = (C_lib.BufferedBlockAlgorithm = Base.extend({
        /**
         * Resets this block algorithm's data buffer to its initial state.
         *
         * @example
         *
         *     bufferedBlockAlgorithm.reset();
         */
        reset: function () {
          // Initial values
          this._data = new WordArray.init();
          this._nDataBytes = 0;
        },

        /**
         * Adds new data to this block algorithm's buffer.
         *
         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
         *
         * @example
         *
         *     bufferedBlockAlgorithm._append('data');
         *     bufferedBlockAlgorithm._append(wordArray);
         */
        _append: function (data) {
          // Convert string to WordArray, else assume WordArray already
          if (typeof data == "string") {
            data = Utf8.parse(data);
          }

          // Append
          this._data.concat(data);
          this._nDataBytes += data.sigBytes;
        },

        /**
         * Processes available data blocks.
         *
         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
         *
         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
         *
         * @return {WordArray} The processed data.
         *
         * @example
         *
         *     var processedData = bufferedBlockAlgorithm._process();
         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
         */
        _process: function (doFlush) {
          var processedWords;

          // Shortcuts
          var data = this._data;
          var dataWords = data.words;
          var dataSigBytes = data.sigBytes;
          var blockSize = this.blockSize;
          var blockSizeBytes = blockSize * 4;

          // Count blocks ready
          var nBlocksReady = dataSigBytes / blockSizeBytes;
          if (doFlush) {
            // Round up to include partial blocks
            nBlocksReady = Math.ceil(nBlocksReady);
          } else {
            // Round down to include only full blocks,
            // less the number of blocks that must remain in the buffer
            nBlocksReady = Math.max(
              (nBlocksReady | 0) - this._minBufferSize,
              0
            );
          }

          // Count words ready
          var nWordsReady = nBlocksReady * blockSize;

          // Count bytes ready
          var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

          // Process blocks
          if (nWordsReady) {
            for (var offset = 0; offset < nWordsReady; offset += blockSize) {
              // Perform concrete-algorithm logic
              this._doProcessBlock(dataWords, offset);
            }

            // Remove processed words
            processedWords = dataWords.splice(0, nWordsReady);
            data.sigBytes -= nBytesReady;
          }

          // Return processed words
          return new WordArray.init(processedWords, nBytesReady);
        },

        /**
         * Creates a copy of this object.
         *
         * @return {Object} The clone.
         *
         * @example
         *
         *     var clone = bufferedBlockAlgorithm.clone();
         */
        clone: function () {
          var clone = Base.clone.call(this);
          clone._data = this._data.clone();

          return clone;
        },

        _minBufferSize: 0,
      }));

      /**
       * Abstract hasher template.
       *
       * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
       */
      var Hasher = (C_lib.Hasher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         */
        cfg: Base.extend(),

        /**
         * Initializes a newly created hasher.
         *
         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
         *
         * @example
         *
         *     var hasher = CryptoJS.algo.SHA256.create();
         */
        init: function (cfg) {
          // Apply config defaults
          this.cfg = this.cfg.extend(cfg);

          // Set initial values
          this.reset();
        },

        /**
         * Resets this hasher to its initial state.
         *
         * @example
         *
         *     hasher.reset();
         */
        reset: function () {
          // Reset data buffer
          BufferedBlockAlgorithm.reset.call(this);

          // Perform concrete-hasher logic
          this._doReset();
        },

        /**
         * Updates this hasher with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {Hasher} This hasher.
         *
         * @example
         *
         *     hasher.update('message');
         *     hasher.update(wordArray);
         */
        update: function (messageUpdate) {
          // Append
          this._append(messageUpdate);

          // Update the hash
          this._process();

          // Chainable
          return this;
        },

        /**
         * Finalizes the hash computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The hash.
         *
         * @example
         *
         *     var hash = hasher.finalize();
         *     var hash = hasher.finalize('message');
         *     var hash = hasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
          // Final message update
          if (messageUpdate) {
            this._append(messageUpdate);
          }

          // Perform concrete-hasher logic
          var hash = this._doFinalize();

          return hash;
        },

        blockSize: 512 / 32,

        /**
         * Creates a shortcut function to a hasher's object interface.
         *
         * @param {Hasher} hasher The hasher to create a helper for.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
         */
        _createHelper: function (hasher) {
          return function (message, cfg) {
            return new hasher.init(cfg).finalize(message);
          };
        },

        /**
         * Creates a shortcut function to the HMAC's object interface.
         *
         * @param {Hasher} hasher The hasher to use in this HMAC helper.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
         */
        _createHmacHelper: function (hasher) {
          return function (message, key) {
            return new C_algo.HMAC.init(hasher, key).finalize(message);
          };
        },
      }));

      /**
       * Algorithm namespace.
       */
      var C_algo = (C.algo = {});

      return C;
    })(Math);

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * Base64 encoding strategy.
     */
    var Base64 = (C_enc.Base64 = {
      /**
       * Converts a word array to a Base64 string.
       *
       * @param {WordArray} wordArray The word array.
       *
       * @return {string} The Base64 string.
       *
       * @static
       *
       * @example
       *
       *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
       */
      stringify: function (wordArray) {
        // Shortcuts
        var words = wordArray.words;
        var sigBytes = wordArray.sigBytes;
        var map = this._map;

        // Clamp excess bits
        wordArray.clamp();

        // Convert
        var base64Chars = [];
        for (var i = 0; i < sigBytes; i += 3) {
          var byte1 = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          var byte2 =
            (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
          var byte3 =
            (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

          var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

          for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
            base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
          }
        }

        // Add padding
        var paddingChar = map.charAt(64);
        if (paddingChar) {
          while (base64Chars.length % 4) {
            base64Chars.push(paddingChar);
          }
        }

        return base64Chars.join("");
      },

      /**
       * Converts a Base64 string to a word array.
       *
       * @param {string} base64Str The Base64 string.
       *
       * @return {WordArray} The word array.
       *
       * @static
       *
       * @example
       *
       *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
       */
      parse: function (base64Str) {
        // Shortcuts
        var base64StrLength = base64Str.length;
        var map = this._map;
        var reverseMap = this._reverseMap;

        if (!reverseMap) {
          reverseMap = this._reverseMap = [];
          for (var j = 0; j < map.length; j++) {
            reverseMap[map.charCodeAt(j)] = j;
          }
        }

        // Ignore padding
        var paddingChar = map.charAt(64);
        if (paddingChar) {
          var paddingIndex = base64Str.indexOf(paddingChar);
          if (paddingIndex !== -1) {
            base64StrLength = paddingIndex;
          }
        }

        // Convert
        return parseLoop(base64Str, base64StrLength, reverseMap);
      },

      _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    });

    function parseLoop(base64Str, base64StrLength, reverseMap) {
      var words = [];
      var nBytes = 0;
      for (var i = 0; i < base64StrLength; i++) {
        if (i % 4) {
          var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << ((i % 4) * 2);
          var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> (6 - (i % 4) * 2);
          var bitsCombined = bits1 | bits2;
          words[nBytes >>> 2] |= bitsCombined << (24 - (nBytes % 4) * 8);
          nBytes++;
        }
      }
      return WordArray.create(words, nBytes);
    }
  })();

  (function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Constants table
    var T = [];

    // Compute constants
    (function () {
      for (var i = 0; i < 64; i++) {
        T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
      }
    })();

    /**
     * MD5 hash algorithm.
     */
    var MD5 = (C_algo.MD5 = Hasher.extend({
      _doReset: function () {
        this._hash = new WordArray.init([
          0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
        ]);
      },

      _doProcessBlock: function (M, offset) {
        // Swap endian
        for (var i = 0; i < 16; i++) {
          // Shortcuts
          var offset_i = offset + i;
          var M_offset_i = M[offset_i];

          M[offset_i] =
            (((M_offset_i << 8) | (M_offset_i >>> 24)) & 0x00ff00ff) |
            (((M_offset_i << 24) | (M_offset_i >>> 8)) & 0xff00ff00);
        }

        // Shortcuts
        var H = this._hash.words;

        var M_offset_0 = M[offset + 0];
        var M_offset_1 = M[offset + 1];
        var M_offset_2 = M[offset + 2];
        var M_offset_3 = M[offset + 3];
        var M_offset_4 = M[offset + 4];
        var M_offset_5 = M[offset + 5];
        var M_offset_6 = M[offset + 6];
        var M_offset_7 = M[offset + 7];
        var M_offset_8 = M[offset + 8];
        var M_offset_9 = M[offset + 9];
        var M_offset_10 = M[offset + 10];
        var M_offset_11 = M[offset + 11];
        var M_offset_12 = M[offset + 12];
        var M_offset_13 = M[offset + 13];
        var M_offset_14 = M[offset + 14];
        var M_offset_15 = M[offset + 15];

        // Working varialbes
        var a = H[0];
        var b = H[1];
        var c = H[2];
        var d = H[3];

        // Computation
        a = FF(a, b, c, d, M_offset_0, 7, T[0]);
        d = FF(d, a, b, c, M_offset_1, 12, T[1]);
        c = FF(c, d, a, b, M_offset_2, 17, T[2]);
        b = FF(b, c, d, a, M_offset_3, 22, T[3]);
        a = FF(a, b, c, d, M_offset_4, 7, T[4]);
        d = FF(d, a, b, c, M_offset_5, 12, T[5]);
        c = FF(c, d, a, b, M_offset_6, 17, T[6]);
        b = FF(b, c, d, a, M_offset_7, 22, T[7]);
        a = FF(a, b, c, d, M_offset_8, 7, T[8]);
        d = FF(d, a, b, c, M_offset_9, 12, T[9]);
        c = FF(c, d, a, b, M_offset_10, 17, T[10]);
        b = FF(b, c, d, a, M_offset_11, 22, T[11]);
        a = FF(a, b, c, d, M_offset_12, 7, T[12]);
        d = FF(d, a, b, c, M_offset_13, 12, T[13]);
        c = FF(c, d, a, b, M_offset_14, 17, T[14]);
        b = FF(b, c, d, a, M_offset_15, 22, T[15]);

        a = GG(a, b, c, d, M_offset_1, 5, T[16]);
        d = GG(d, a, b, c, M_offset_6, 9, T[17]);
        c = GG(c, d, a, b, M_offset_11, 14, T[18]);
        b = GG(b, c, d, a, M_offset_0, 20, T[19]);
        a = GG(a, b, c, d, M_offset_5, 5, T[20]);
        d = GG(d, a, b, c, M_offset_10, 9, T[21]);
        c = GG(c, d, a, b, M_offset_15, 14, T[22]);
        b = GG(b, c, d, a, M_offset_4, 20, T[23]);
        a = GG(a, b, c, d, M_offset_9, 5, T[24]);
        d = GG(d, a, b, c, M_offset_14, 9, T[25]);
        c = GG(c, d, a, b, M_offset_3, 14, T[26]);
        b = GG(b, c, d, a, M_offset_8, 20, T[27]);
        a = GG(a, b, c, d, M_offset_13, 5, T[28]);
        d = GG(d, a, b, c, M_offset_2, 9, T[29]);
        c = GG(c, d, a, b, M_offset_7, 14, T[30]);
        b = GG(b, c, d, a, M_offset_12, 20, T[31]);

        a = HH(a, b, c, d, M_offset_5, 4, T[32]);
        d = HH(d, a, b, c, M_offset_8, 11, T[33]);
        c = HH(c, d, a, b, M_offset_11, 16, T[34]);
        b = HH(b, c, d, a, M_offset_14, 23, T[35]);
        a = HH(a, b, c, d, M_offset_1, 4, T[36]);
        d = HH(d, a, b, c, M_offset_4, 11, T[37]);
        c = HH(c, d, a, b, M_offset_7, 16, T[38]);
        b = HH(b, c, d, a, M_offset_10, 23, T[39]);
        a = HH(a, b, c, d, M_offset_13, 4, T[40]);
        d = HH(d, a, b, c, M_offset_0, 11, T[41]);
        c = HH(c, d, a, b, M_offset_3, 16, T[42]);
        b = HH(b, c, d, a, M_offset_6, 23, T[43]);
        a = HH(a, b, c, d, M_offset_9, 4, T[44]);
        d = HH(d, a, b, c, M_offset_12, 11, T[45]);
        c = HH(c, d, a, b, M_offset_15, 16, T[46]);
        b = HH(b, c, d, a, M_offset_2, 23, T[47]);

        a = II(a, b, c, d, M_offset_0, 6, T[48]);
        d = II(d, a, b, c, M_offset_7, 10, T[49]);
        c = II(c, d, a, b, M_offset_14, 15, T[50]);
        b = II(b, c, d, a, M_offset_5, 21, T[51]);
        a = II(a, b, c, d, M_offset_12, 6, T[52]);
        d = II(d, a, b, c, M_offset_3, 10, T[53]);
        c = II(c, d, a, b, M_offset_10, 15, T[54]);
        b = II(b, c, d, a, M_offset_1, 21, T[55]);
        a = II(a, b, c, d, M_offset_8, 6, T[56]);
        d = II(d, a, b, c, M_offset_15, 10, T[57]);
        c = II(c, d, a, b, M_offset_6, 15, T[58]);
        b = II(b, c, d, a, M_offset_13, 21, T[59]);
        a = II(a, b, c, d, M_offset_4, 6, T[60]);
        d = II(d, a, b, c, M_offset_11, 10, T[61]);
        c = II(c, d, a, b, M_offset_2, 15, T[62]);
        b = II(b, c, d, a, M_offset_9, 21, T[63]);

        // Intermediate hash value
        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;

        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));

        var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
        var nBitsTotalL = nBitsTotal;
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] =
          (((nBitsTotalH << 8) | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
          (((nBitsTotalH << 24) | (nBitsTotalH >>> 8)) & 0xff00ff00);
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] =
          (((nBitsTotalL << 8) | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
          (((nBitsTotalL << 24) | (nBitsTotalL >>> 8)) & 0xff00ff00);

        data.sigBytes = (dataWords.length + 1) * 4;

        // Hash final blocks
        this._process();

        // Shortcuts
        var hash = this._hash;
        var H = hash.words;

        // Swap endian
        for (var i = 0; i < 4; i++) {
          // Shortcut
          var H_i = H[i];

          H[i] =
            (((H_i << 8) | (H_i >>> 24)) & 0x00ff00ff) |
            (((H_i << 24) | (H_i >>> 8)) & 0xff00ff00);
        }

        // Return final computed hash
        return hash;
      },

      clone: function () {
        var clone = Hasher.clone.call(this);
        clone._hash = this._hash.clone();

        return clone;
      },
    }));

    function FF(a, b, c, d, x, s, t) {
      var n = a + ((b & c) | (~b & d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }

    function GG(a, b, c, d, x, s, t) {
      var n = a + ((b & d) | (c & ~d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }

    function HH(a, b, c, d, x, s, t) {
      var n = a + (b ^ c ^ d) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }

    function II(a, b, c, d, x, s, t) {
      var n = a + (c ^ (b | ~d)) + x + t;
      return ((n << s) | (n >>> (32 - s))) + b;
    }

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.MD5('message');
     *     var hash = CryptoJS.MD5(wordArray);
     */
    C.MD5 = Hasher._createHelper(MD5);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacMD5(message, key);
     */
    C.HmacMD5 = Hasher._createHmacHelper(MD5);
  })(Math);

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Reusable object
    var W = [];

    /**
     * SHA-1 hash algorithm.
     */
    var SHA1 = (C_algo.SHA1 = Hasher.extend({
      _doReset: function () {
        this._hash = new WordArray.init([
          0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
        ]);
      },

      _doProcessBlock: function (M, offset) {
        // Shortcut
        var H = this._hash.words;

        // Working variables
        var a = H[0];
        var b = H[1];
        var c = H[2];
        var d = H[3];
        var e = H[4];

        // Computation
        for (var i = 0; i < 80; i++) {
          if (i < 16) {
            W[i] = M[offset + i] | 0;
          } else {
            var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
            W[i] = (n << 1) | (n >>> 31);
          }

          var t = ((a << 5) | (a >>> 27)) + e + W[i];
          if (i < 20) {
            t += ((b & c) | (~b & d)) + 0x5a827999;
          } else if (i < 40) {
            t += (b ^ c ^ d) + 0x6ed9eba1;
          } else if (i < 60) {
            t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
          } /* if (i < 80) */ else {
            t += (b ^ c ^ d) - 0x359d3e2a;
          }

          e = d;
          d = c;
          c = (b << 30) | (b >>> 2);
          b = a;
          a = t;
        }

        // Intermediate hash value
        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0;
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;

        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(
          nBitsTotal / 0x100000000
        );
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
        data.sigBytes = dataWords.length * 4;

        // Hash final blocks
        this._process();

        // Return final computed hash
        return this._hash;
      },

      clone: function () {
        var clone = Hasher.clone.call(this);
        clone._hash = this._hash.clone();

        return clone;
      },
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA1('message');
     *     var hash = CryptoJS.SHA1(wordArray);
     */
    C.SHA1 = Hasher._createHelper(SHA1);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA1(message, key);
     */
    C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
  })();

  (function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Initialization and round constants tables
    var H = [];
    var K = [];

    // Compute constants
    (function () {
      function isPrime(n) {
        var sqrtN = Math.sqrt(n);
        for (var factor = 2; factor <= sqrtN; factor++) {
          if (!(n % factor)) {
            return false;
          }
        }

        return true;
      }

      function getFractionalBits(n) {
        return ((n - (n | 0)) * 0x100000000) | 0;
      }

      var n = 2;
      var nPrime = 0;
      while (nPrime < 64) {
        if (isPrime(n)) {
          if (nPrime < 8) {
            H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
          }
          K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

          nPrime++;
        }

        n++;
      }
    })();

    // Reusable object
    var W = [];

    /**
     * SHA-256 hash algorithm.
     */
    var SHA256 = (C_algo.SHA256 = Hasher.extend({
      _doReset: function () {
        this._hash = new WordArray.init(H.slice(0));
      },

      _doProcessBlock: function (M, offset) {
        // Shortcut
        var H = this._hash.words;

        // Working variables
        var a = H[0];
        var b = H[1];
        var c = H[2];
        var d = H[3];
        var e = H[4];
        var f = H[5];
        var g = H[6];
        var h = H[7];

        // Computation
        for (var i = 0; i < 64; i++) {
          if (i < 16) {
            W[i] = M[offset + i] | 0;
          } else {
            var gamma0x = W[i - 15];
            var gamma0 =
              ((gamma0x << 25) | (gamma0x >>> 7)) ^
              ((gamma0x << 14) | (gamma0x >>> 18)) ^
              (gamma0x >>> 3);

            var gamma1x = W[i - 2];
            var gamma1 =
              ((gamma1x << 15) | (gamma1x >>> 17)) ^
              ((gamma1x << 13) | (gamma1x >>> 19)) ^
              (gamma1x >>> 10);

            W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
          }

          var ch = (e & f) ^ (~e & g);
          var maj = (a & b) ^ (a & c) ^ (b & c);

          var sigma0 =
            ((a << 30) | (a >>> 2)) ^
            ((a << 19) | (a >>> 13)) ^
            ((a << 10) | (a >>> 22));
          var sigma1 =
            ((e << 26) | (e >>> 6)) ^
            ((e << 21) | (e >>> 11)) ^
            ((e << 7) | (e >>> 25));

          var t1 = h + sigma1 + ch + K[i] + W[i];
          var t2 = sigma0 + maj;

          h = g;
          g = f;
          f = e;
          e = (d + t1) | 0;
          d = c;
          c = b;
          b = a;
          a = (t1 + t2) | 0;
        }

        // Intermediate hash value
        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0;
        H[5] = (H[5] + f) | 0;
        H[6] = (H[6] + g) | 0;
        H[7] = (H[7] + h) | 0;
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;

        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(
          nBitsTotal / 0x100000000
        );
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
        data.sigBytes = dataWords.length * 4;

        // Hash final blocks
        this._process();

        // Return final computed hash
        return this._hash;
      },

      clone: function () {
        var clone = Hasher.clone.call(this);
        clone._hash = this._hash.clone();

        return clone;
      },
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA256('message');
     *     var hash = CryptoJS.SHA256(wordArray);
     */
    C.SHA256 = Hasher._createHelper(SHA256);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA256(message, key);
     */
    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
  })(Math);

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * UTF-16 BE encoding strategy.
     */
    var Utf16BE =
      (C_enc.Utf16 =
      C_enc.Utf16BE =
        {
          /**
           * Converts a word array to a UTF-16 BE string.
           *
           * @param {WordArray} wordArray The word array.
           *
           * @return {string} The UTF-16 BE string.
           *
           * @static
           *
           * @example
           *
           *     var utf16String = CryptoJS.enc.Utf16.stringify(wordArray);
           */
          stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;

            // Convert
            var utf16Chars = [];
            for (var i = 0; i < sigBytes; i += 2) {
              var codePoint = (words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff;
              utf16Chars.push(String.fromCharCode(codePoint));
            }

            return utf16Chars.join("");
          },

          /**
           * Converts a UTF-16 BE string to a word array.
           *
           * @param {string} utf16Str The UTF-16 BE string.
           *
           * @return {WordArray} The word array.
           *
           * @static
           *
           * @example
           *
           *     var wordArray = CryptoJS.enc.Utf16.parse(utf16String);
           */
          parse: function (utf16Str) {
            // Shortcut
            var utf16StrLength = utf16Str.length;

            // Convert
            var words = [];
            for (var i = 0; i < utf16StrLength; i++) {
              words[i >>> 1] |= utf16Str.charCodeAt(i) << (16 - (i % 2) * 16);
            }

            return WordArray.create(words, utf16StrLength * 2);
          },
        });

    /**
     * UTF-16 LE encoding strategy.
     */
    C_enc.Utf16LE = {
      /**
       * Converts a word array to a UTF-16 LE string.
       *
       * @param {WordArray} wordArray The word array.
       *
       * @return {string} The UTF-16 LE string.
       *
       * @static
       *
       * @example
       *
       *     var utf16Str = CryptoJS.enc.Utf16LE.stringify(wordArray);
       */
      stringify: function (wordArray) {
        // Shortcuts
        var words = wordArray.words;
        var sigBytes = wordArray.sigBytes;

        // Convert
        var utf16Chars = [];
        for (var i = 0; i < sigBytes; i += 2) {
          var codePoint = swapEndian(
            (words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff
          );
          utf16Chars.push(String.fromCharCode(codePoint));
        }

        return utf16Chars.join("");
      },

      /**
       * Converts a UTF-16 LE string to a word array.
       *
       * @param {string} utf16Str The UTF-16 LE string.
       *
       * @return {WordArray} The word array.
       *
       * @static
       *
       * @example
       *
       *     var wordArray = CryptoJS.enc.Utf16LE.parse(utf16Str);
       */
      parse: function (utf16Str) {
        // Shortcut
        var utf16StrLength = utf16Str.length;

        // Convert
        var words = [];
        for (var i = 0; i < utf16StrLength; i++) {
          words[i >>> 1] |= swapEndian(
            utf16Str.charCodeAt(i) << (16 - (i % 2) * 16)
          );
        }

        return WordArray.create(words, utf16StrLength * 2);
      },
    };

    function swapEndian(word) {
      return ((word << 8) & 0xff00ff00) | ((word >>> 8) & 0x00ff00ff);
    }
  })();

  (function () {
    // Check if typed arrays are supported
    if (typeof ArrayBuffer != "function") {
      return;
    }

    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;

    // Reference original init
    var superInit = WordArray.init;

    // Augment WordArray.init to handle typed arrays
    var subInit = (WordArray.init = function (typedArray) {
      // Convert buffers to uint8
      if (typedArray instanceof ArrayBuffer) {
        typedArray = new Uint8Array(typedArray);
      }

      // Convert other array views to uint8
      if (
        typedArray instanceof Int8Array ||
        (typeof Uint8ClampedArray !== "undefined" &&
          typedArray instanceof Uint8ClampedArray) ||
        typedArray instanceof Int16Array ||
        typedArray instanceof Uint16Array ||
        typedArray instanceof Int32Array ||
        typedArray instanceof Uint32Array ||
        typedArray instanceof Float32Array ||
        typedArray instanceof Float64Array
      ) {
        typedArray = new Uint8Array(
          typedArray.buffer,
          typedArray.byteOffset,
          typedArray.byteLength
        );
      }

      // Handle Uint8Array
      if (typedArray instanceof Uint8Array) {
        // Shortcut
        var typedArrayByteLength = typedArray.byteLength;

        // Extract bytes
        var words = [];
        for (var i = 0; i < typedArrayByteLength; i++) {
          words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
        }

        // Initialize this word array
        superInit.call(this, words, typedArrayByteLength);
      } else {
        // Else call normal init
        superInit.apply(this, arguments);
      }
    });

    subInit.prototype = WordArray;
  })();

  /** @preserve
	(c) 2012 by Cédric Mesnil. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

	    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
	    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	*/

  (function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Constants table
    var _zl = WordArray.create([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6,
      15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6,
      13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0,
      5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
    ]);
    var _zr = WordArray.create([
      5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13,
      5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2,
      10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12,
      15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
    ]);
    var _sl = WordArray.create([
      11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11,
      9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8,
      13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5,
      12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
    ]);
    var _sr = WordArray.create([
      8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12,
      8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13,
      5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15,
      8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
    ]);

    var _hl = WordArray.create([
      0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e,
    ]);
    var _hr = WordArray.create([
      0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000,
    ]);

    /**
     * RIPEMD160 hash algorithm.
     */
    var RIPEMD160 = (C_algo.RIPEMD160 = Hasher.extend({
      _doReset: function () {
        this._hash = WordArray.create([
          0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0,
        ]);
      },

      _doProcessBlock: function (M, offset) {
        // Swap endian
        for (var i = 0; i < 16; i++) {
          // Shortcuts
          var offset_i = offset + i;
          var M_offset_i = M[offset_i];

          // Swap
          M[offset_i] =
            (((M_offset_i << 8) | (M_offset_i >>> 24)) & 0x00ff00ff) |
            (((M_offset_i << 24) | (M_offset_i >>> 8)) & 0xff00ff00);
        }
        // Shortcut
        var H = this._hash.words;
        var hl = _hl.words;
        var hr = _hr.words;
        var zl = _zl.words;
        var zr = _zr.words;
        var sl = _sl.words;
        var sr = _sr.words;

        // Working variables
        var al, bl, cl, dl, el;
        var ar, br, cr, dr, er;

        ar = al = H[0];
        br = bl = H[1];
        cr = cl = H[2];
        dr = dl = H[3];
        er = el = H[4];
        // Computation
        var t;
        for (var i = 0; i < 80; i += 1) {
          t = (al + M[offset + zl[i]]) | 0;
          if (i < 16) {
            t += f1(bl, cl, dl) + hl[0];
          } else if (i < 32) {
            t += f2(bl, cl, dl) + hl[1];
          } else if (i < 48) {
            t += f3(bl, cl, dl) + hl[2];
          } else if (i < 64) {
            t += f4(bl, cl, dl) + hl[3];
          } else {
            // if (i<80) {
            t += f5(bl, cl, dl) + hl[4];
          }
          t = t | 0;
          t = rotl(t, sl[i]);
          t = (t + el) | 0;
          al = el;
          el = dl;
          dl = rotl(cl, 10);
          cl = bl;
          bl = t;

          t = (ar + M[offset + zr[i]]) | 0;
          if (i < 16) {
            t += f5(br, cr, dr) + hr[0];
          } else if (i < 32) {
            t += f4(br, cr, dr) + hr[1];
          } else if (i < 48) {
            t += f3(br, cr, dr) + hr[2];
          } else if (i < 64) {
            t += f2(br, cr, dr) + hr[3];
          } else {
            // if (i<80) {
            t += f1(br, cr, dr) + hr[4];
          }
          t = t | 0;
          t = rotl(t, sr[i]);
          t = (t + er) | 0;
          ar = er;
          er = dr;
          dr = rotl(cr, 10);
          cr = br;
          br = t;
        }
        // Intermediate hash value
        t = (H[1] + cl + dr) | 0;
        H[1] = (H[2] + dl + er) | 0;
        H[2] = (H[3] + el + ar) | 0;
        H[3] = (H[4] + al + br) | 0;
        H[4] = (H[0] + bl + cr) | 0;
        H[0] = t;
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;

        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));
        dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] =
          (((nBitsTotal << 8) | (nBitsTotal >>> 24)) & 0x00ff00ff) |
          (((nBitsTotal << 24) | (nBitsTotal >>> 8)) & 0xff00ff00);
        data.sigBytes = (dataWords.length + 1) * 4;

        // Hash final blocks
        this._process();

        // Shortcuts
        var hash = this._hash;
        var H = hash.words;

        // Swap endian
        for (var i = 0; i < 5; i++) {
          // Shortcut
          var H_i = H[i];

          // Swap
          H[i] =
            (((H_i << 8) | (H_i >>> 24)) & 0x00ff00ff) |
            (((H_i << 24) | (H_i >>> 8)) & 0xff00ff00);
        }

        // Return final computed hash
        return hash;
      },

      clone: function () {
        var clone = Hasher.clone.call(this);
        clone._hash = this._hash.clone();

        return clone;
      },
    }));

    function f1(x, y, z) {
      return x ^ y ^ z;
    }

    function f2(x, y, z) {
      return (x & y) | (~x & z);
    }

    function f3(x, y, z) {
      return (x | ~y) ^ z;
    }

    function f4(x, y, z) {
      return (x & z) | (y & ~z);
    }

    function f5(x, y, z) {
      return x ^ (y | ~z);
    }

    function rotl(x, n) {
      return (x << n) | (x >>> (32 - n));
    }

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.RIPEMD160('message');
     *     var hash = CryptoJS.RIPEMD160(wordArray);
     */
    C.RIPEMD160 = Hasher._createHelper(RIPEMD160);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacRIPEMD160(message, key);
     */
    C.HmacRIPEMD160 = Hasher._createHmacHelper(RIPEMD160);
  })(Math);

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var C_algo = C.algo;

    /**
     * HMAC algorithm.
     */
    var HMAC = (C_algo.HMAC = Base.extend({
      /**
       * Initializes a newly created HMAC.
       *
       * @param {Hasher} hasher The hash algorithm to use.
       * @param {WordArray|string} key The secret key.
       *
       * @example
       *
       *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
       */
      init: function (hasher, key) {
        // Init hasher
        hasher = this._hasher = new hasher.init();

        // Convert string to WordArray, else assume WordArray already
        if (typeof key == "string") {
          key = Utf8.parse(key);
        }

        // Shortcuts
        var hasherBlockSize = hasher.blockSize;
        var hasherBlockSizeBytes = hasherBlockSize * 4;

        // Allow arbitrary length keys
        if (key.sigBytes > hasherBlockSizeBytes) {
          key = hasher.finalize(key);
        }

        // Clamp excess bits
        key.clamp();

        // Clone key for inner and outer pads
        var oKey = (this._oKey = key.clone());
        var iKey = (this._iKey = key.clone());

        // Shortcuts
        var oKeyWords = oKey.words;
        var iKeyWords = iKey.words;

        // XOR keys with pad constants
        for (var i = 0; i < hasherBlockSize; i++) {
          oKeyWords[i] ^= 0x5c5c5c5c;
          iKeyWords[i] ^= 0x36363636;
        }
        oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

        // Set initial values
        this.reset();
      },

      /**
       * Resets this HMAC to its initial state.
       *
       * @example
       *
       *     hmacHasher.reset();
       */
      reset: function () {
        // Shortcut
        var hasher = this._hasher;

        // Reset
        hasher.reset();
        hasher.update(this._iKey);
      },

      /**
       * Updates this HMAC with a message.
       *
       * @param {WordArray|string} messageUpdate The message to append.
       *
       * @return {HMAC} This HMAC instance.
       *
       * @example
       *
       *     hmacHasher.update('message');
       *     hmacHasher.update(wordArray);
       */
      update: function (messageUpdate) {
        this._hasher.update(messageUpdate);

        // Chainable
        return this;
      },

      /**
       * Finalizes the HMAC computation.
       * Note that the finalize operation is effectively a destructive, read-once operation.
       *
       * @param {WordArray|string} messageUpdate (Optional) A final message update.
       *
       * @return {WordArray} The HMAC.
       *
       * @example
       *
       *     var hmac = hmacHasher.finalize();
       *     var hmac = hmacHasher.finalize('message');
       *     var hmac = hmacHasher.finalize(wordArray);
       */
      finalize: function (messageUpdate) {
        // Shortcut
        var hasher = this._hasher;

        // Compute HMAC
        var innerHash = hasher.finalize(messageUpdate);
        hasher.reset();
        var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

        return hmac;
      },
    }));
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var WordArray = C_lib.WordArray;
    var C_algo = C.algo;
    var SHA1 = C_algo.SHA1;
    var HMAC = C_algo.HMAC;

    /**
     * Password-Based Key Derivation Function 2 algorithm.
     */
    var PBKDF2 = (C_algo.PBKDF2 = Base.extend({
      /**
       * Configuration options.
       *
       * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
       * @property {Hasher} hasher The hasher to use. Default: SHA1
       * @property {number} iterations The number of iterations to perform. Default: 1
       */
      cfg: Base.extend({
        keySize: 128 / 32,
        hasher: SHA1,
        iterations: 1,
      }),

      /**
       * Initializes a newly created key derivation function.
       *
       * @param {Object} cfg (Optional) The configuration options to use for the derivation.
       *
       * @example
       *
       *     var kdf = CryptoJS.algo.PBKDF2.create();
       *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8 });
       *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8, iterations: 1000 });
       */
      init: function (cfg) {
        this.cfg = this.cfg.extend(cfg);
      },

      /**
       * Computes the Password-Based Key Derivation Function 2.
       *
       * @param {WordArray|string} password The password.
       * @param {WordArray|string} salt A salt.
       *
       * @return {WordArray} The derived key.
       *
       * @example
       *
       *     var key = kdf.compute(password, salt);
       */
      compute: function (password, salt) {
        // Shortcut
        var cfg = this.cfg;

        // Init HMAC
        var hmac = HMAC.create(cfg.hasher, password);

        // Initial values
        var derivedKey = WordArray.create();
        var blockIndex = WordArray.create([0x00000001]);

        // Shortcuts
        var derivedKeyWords = derivedKey.words;
        var blockIndexWords = blockIndex.words;
        var keySize = cfg.keySize;
        var iterations = cfg.iterations;

        // Generate key
        while (derivedKeyWords.length < keySize) {
          var block = hmac.update(salt).finalize(blockIndex);
          hmac.reset();

          // Shortcuts
          var blockWords = block.words;
          var blockWordsLength = blockWords.length;

          // Iterations
          var intermediate = block;
          for (var i = 1; i < iterations; i++) {
            intermediate = hmac.finalize(intermediate);
            hmac.reset();

            // Shortcut
            var intermediateWords = intermediate.words;

            // XOR intermediate with block
            for (var j = 0; j < blockWordsLength; j++) {
              blockWords[j] ^= intermediateWords[j];
            }
          }

          derivedKey.concat(block);
          blockIndexWords[0]++;
        }
        derivedKey.sigBytes = keySize * 4;

        return derivedKey;
      },
    }));

    /**
     * Computes the Password-Based Key Derivation Function 2.
     *
     * @param {WordArray|string} password The password.
     * @param {WordArray|string} salt A salt.
     * @param {Object} cfg (Optional) The configuration options to use for this computation.
     *
     * @return {WordArray} The derived key.
     *
     * @static
     *
     * @example
     *
     *     var key = CryptoJS.PBKDF2(password, salt);
     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8 });
     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations: 1000 });
     */
    C.PBKDF2 = function (password, salt, cfg) {
      return PBKDF2.create(cfg).compute(password, salt);
    };
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var WordArray = C_lib.WordArray;
    var C_algo = C.algo;
    var MD5 = C_algo.MD5;

    /**
     * This key derivation function is meant to conform with EVP_BytesToKey.
     * www.openssl.org/docs/crypto/EVP_BytesToKey.html
     */
    var EvpKDF = (C_algo.EvpKDF = Base.extend({
      /**
       * Configuration options.
       *
       * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
       * @property {Hasher} hasher The hash algorithm to use. Default: MD5
       * @property {number} iterations The number of iterations to perform. Default: 1
       */
      cfg: Base.extend({
        keySize: 128 / 32,
        hasher: MD5,
        iterations: 1,
      }),

      /**
       * Initializes a newly created key derivation function.
       *
       * @param {Object} cfg (Optional) The configuration options to use for the derivation.
       *
       * @example
       *
       *     var kdf = CryptoJS.algo.EvpKDF.create();
       *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
       *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
       */
      init: function (cfg) {
        this.cfg = this.cfg.extend(cfg);
      },

      /**
       * Derives a key from a password.
       *
       * @param {WordArray|string} password The password.
       * @param {WordArray|string} salt A salt.
       *
       * @return {WordArray} The derived key.
       *
       * @example
       *
       *     var key = kdf.compute(password, salt);
       */
      compute: function (password, salt) {
        var block;

        // Shortcut
        var cfg = this.cfg;

        // Init hasher
        var hasher = cfg.hasher.create();

        // Initial values
        var derivedKey = WordArray.create();

        // Shortcuts
        var derivedKeyWords = derivedKey.words;
        var keySize = cfg.keySize;
        var iterations = cfg.iterations;

        // Generate key
        while (derivedKeyWords.length < keySize) {
          if (block) {
            hasher.update(block);
          }
          block = hasher.update(password).finalize(salt);
          hasher.reset();

          // Iterations
          for (var i = 1; i < iterations; i++) {
            block = hasher.finalize(block);
            hasher.reset();
          }

          derivedKey.concat(block);
        }
        derivedKey.sigBytes = keySize * 4;

        return derivedKey;
      },
    }));

    /**
     * Derives a key from a password.
     *
     * @param {WordArray|string} password The password.
     * @param {WordArray|string} salt A salt.
     * @param {Object} cfg (Optional) The configuration options to use for this computation.
     *
     * @return {WordArray} The derived key.
     *
     * @static
     *
     * @example
     *
     *     var key = CryptoJS.EvpKDF(password, salt);
     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
     */
    C.EvpKDF = function (password, salt, cfg) {
      return EvpKDF.create(cfg).compute(password, salt);
    };
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_algo = C.algo;
    var SHA256 = C_algo.SHA256;

    /**
     * SHA-224 hash algorithm.
     */
    var SHA224 = (C_algo.SHA224 = SHA256.extend({
      _doReset: function () {
        this._hash = new WordArray.init([
          0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31,
          0x68581511, 0x64f98fa7, 0xbefa4fa4,
        ]);
      },

      _doFinalize: function () {
        var hash = SHA256._doFinalize.call(this);

        hash.sigBytes -= 4;

        return hash;
      },
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA224('message');
     *     var hash = CryptoJS.SHA224(wordArray);
     */
    C.SHA224 = SHA256._createHelper(SHA224);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA224(message, key);
     */
    C.HmacSHA224 = SHA256._createHmacHelper(SHA224);
  })();

  (function (undefined) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var X32WordArray = C_lib.WordArray;

    /**
     * x64 namespace.
     */
    var C_x64 = (C.x64 = {});

    /**
     * A 64-bit word.
     */
    var X64Word = (C_x64.Word = Base.extend({
      /**
       * Initializes a newly created 64-bit word.
       *
       * @param {number} high The high 32 bits.
       * @param {number} low The low 32 bits.
       *
       * @example
       *
       *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
       */
      init: function (high, low) {
        this.high = high;
        this.low = low;
      },

      /**
       * Bitwise NOTs this word.
       *
       * @return {X64Word} A new x64-Word object after negating.
       *
       * @example
       *
       *     var negated = x64Word.not();
       */
      // not: function () {
      // var high = ~this.high;
      // var low = ~this.low;

      // return X64Word.create(high, low);
      // },

      /**
       * Bitwise ANDs this word with the passed word.
       *
       * @param {X64Word} word The x64-Word to AND with this word.
       *
       * @return {X64Word} A new x64-Word object after ANDing.
       *
       * @example
       *
       *     var anded = x64Word.and(anotherX64Word);
       */
      // and: function (word) {
      // var high = this.high & word.high;
      // var low = this.low & word.low;

      // return X64Word.create(high, low);
      // },

      /**
       * Bitwise ORs this word with the passed word.
       *
       * @param {X64Word} word The x64-Word to OR with this word.
       *
       * @return {X64Word} A new x64-Word object after ORing.
       *
       * @example
       *
       *     var ored = x64Word.or(anotherX64Word);
       */
      // or: function (word) {
      // var high = this.high | word.high;
      // var low = this.low | word.low;

      // return X64Word.create(high, low);
      // },

      /**
       * Bitwise XORs this word with the passed word.
       *
       * @param {X64Word} word The x64-Word to XOR with this word.
       *
       * @return {X64Word} A new x64-Word object after XORing.
       *
       * @example
       *
       *     var xored = x64Word.xor(anotherX64Word);
       */
      // xor: function (word) {
      // var high = this.high ^ word.high;
      // var low = this.low ^ word.low;

      // return X64Word.create(high, low);
      // },

      /**
       * Shifts this word n bits to the left.
       *
       * @param {number} n The number of bits to shift.
       *
       * @return {X64Word} A new x64-Word object after shifting.
       *
       * @example
       *
       *     var shifted = x64Word.shiftL(25);
       */
      // shiftL: function (n) {
      // if (n < 32) {
      // var high = (this.high << n) | (this.low >>> (32 - n));
      // var low = this.low << n;
      // } else {
      // var high = this.low << (n - 32);
      // var low = 0;
      // }

      // return X64Word.create(high, low);
      // },

      /**
       * Shifts this word n bits to the right.
       *
       * @param {number} n The number of bits to shift.
       *
       * @return {X64Word} A new x64-Word object after shifting.
       *
       * @example
       *
       *     var shifted = x64Word.shiftR(7);
       */
      // shiftR: function (n) {
      // if (n < 32) {
      // var low = (this.low >>> n) | (this.high << (32 - n));
      // var high = this.high >>> n;
      // } else {
      // var low = this.high >>> (n - 32);
      // var high = 0;
      // }

      // return X64Word.create(high, low);
      // },

      /**
       * Rotates this word n bits to the left.
       *
       * @param {number} n The number of bits to rotate.
       *
       * @return {X64Word} A new x64-Word object after rotating.
       *
       * @example
       *
       *     var rotated = x64Word.rotL(25);
       */
      // rotL: function (n) {
      // return this.shiftL(n).or(this.shiftR(64 - n));
      // },

      /**
       * Rotates this word n bits to the right.
       *
       * @param {number} n The number of bits to rotate.
       *
       * @return {X64Word} A new x64-Word object after rotating.
       *
       * @example
       *
       *     var rotated = x64Word.rotR(7);
       */
      // rotR: function (n) {
      // return this.shiftR(n).or(this.shiftL(64 - n));
      // },

      /**
       * Adds this word with the passed word.
       *
       * @param {X64Word} word The x64-Word to add with this word.
       *
       * @return {X64Word} A new x64-Word object after adding.
       *
       * @example
       *
       *     var added = x64Word.add(anotherX64Word);
       */
      // add: function (word) {
      // var low = (this.low + word.low) | 0;
      // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
      // var high = (this.high + word.high + carry) | 0;

      // return X64Word.create(high, low);
      // }
    }));

    /**
     * An array of 64-bit words.
     *
     * @property {Array} words The array of CryptoJS.x64.Word objects.
     * @property {number} sigBytes The number of significant bytes in this word array.
     */
    var X64WordArray = (C_x64.WordArray = Base.extend({
      /**
       * Initializes a newly created word array.
       *
       * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
       * @param {number} sigBytes (Optional) The number of significant bytes in the words.
       *
       * @example
       *
       *     var wordArray = CryptoJS.x64.WordArray.create();
       *
       *     var wordArray = CryptoJS.x64.WordArray.create([
       *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
       *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
       *     ]);
       *
       *     var wordArray = CryptoJS.x64.WordArray.create([
       *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
       *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
       *     ], 10);
       */
      init: function (words, sigBytes) {
        words = this.words = words || [];

        if (sigBytes != undefined) {
          this.sigBytes = sigBytes;
        } else {
          this.sigBytes = words.length * 8;
        }
      },

      /**
       * Converts this 64-bit word array to a 32-bit word array.
       *
       * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
       *
       * @example
       *
       *     var x32WordArray = x64WordArray.toX32();
       */
      toX32: function () {
        // Shortcuts
        var x64Words = this.words;
        var x64WordsLength = x64Words.length;

        // Convert
        var x32Words = [];
        for (var i = 0; i < x64WordsLength; i++) {
          var x64Word = x64Words[i];
          x32Words.push(x64Word.high);
          x32Words.push(x64Word.low);
        }

        return X32WordArray.create(x32Words, this.sigBytes);
      },

      /**
       * Creates a copy of this word array.
       *
       * @return {X64WordArray} The clone.
       *
       * @example
       *
       *     var clone = x64WordArray.clone();
       */
      clone: function () {
        var clone = Base.clone.call(this);

        // Clone "words" array
        var words = (clone.words = this.words.slice(0));

        // Clone each X64Word object
        var wordsLength = words.length;
        for (var i = 0; i < wordsLength; i++) {
          words[i] = words[i].clone();
        }

        return clone;
      },
    }));
  })();

  (function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_x64 = C.x64;
    var X64Word = C_x64.Word;
    var C_algo = C.algo;

    // Constants tables
    var RHO_OFFSETS = [];
    var PI_INDEXES = [];
    var ROUND_CONSTANTS = [];

    // Compute Constants
    (function () {
      // Compute rho offset constants
      var x = 1,
        y = 0;
      for (var t = 0; t < 24; t++) {
        RHO_OFFSETS[x + 5 * y] = (((t + 1) * (t + 2)) / 2) % 64;

        var newX = y % 5;
        var newY = (2 * x + 3 * y) % 5;
        x = newX;
        y = newY;
      }

      // Compute pi index constants
      for (var x = 0; x < 5; x++) {
        for (var y = 0; y < 5; y++) {
          PI_INDEXES[x + 5 * y] = y + ((2 * x + 3 * y) % 5) * 5;
        }
      }

      // Compute round constants
      var LFSR = 0x01;
      for (var i = 0; i < 24; i++) {
        var roundConstantMsw = 0;
        var roundConstantLsw = 0;

        for (var j = 0; j < 7; j++) {
          if (LFSR & 0x01) {
            var bitPosition = (1 << j) - 1;
            if (bitPosition < 32) {
              roundConstantLsw ^= 1 << bitPosition;
            } /* if (bitPosition >= 32) */ else {
              roundConstantMsw ^= 1 << (bitPosition - 32);
            }
          }

          // Compute next LFSR
          if (LFSR & 0x80) {
            // Primitive polynomial over GF(2): x^8 + x^6 + x^5 + x^4 + 1
            LFSR = (LFSR << 1) ^ 0x71;
          } else {
            LFSR <<= 1;
          }
        }

        ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
      }
    })();

    // Reusable objects for temporary values
    var T = [];
    (function () {
      for (var i = 0; i < 25; i++) {
        T[i] = X64Word.create();
      }
    })();

    /**
     * SHA-3 hash algorithm.
     */
    var SHA3 = (C_algo.SHA3 = Hasher.extend({
      /**
       * Configuration options.
       *
       * @property {number} outputLength
       *   The desired number of bits in the output hash.
       *   Only values permitted are: 224, 256, 384, 512.
       *   Default: 512
       */
      cfg: Hasher.cfg.extend({
        outputLength: 512,
      }),

      _doReset: function () {
        var state = (this._state = []);
        for (var i = 0; i < 25; i++) {
          state[i] = new X64Word.init();
        }

        this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
      },

      _doProcessBlock: function (M, offset) {
        // Shortcuts
        var state = this._state;
        var nBlockSizeLanes = this.blockSize / 2;

        // Absorb
        for (var i = 0; i < nBlockSizeLanes; i++) {
          // Shortcuts
          var M2i = M[offset + 2 * i];
          var M2i1 = M[offset + 2 * i + 1];

          // Swap endian
          M2i =
            (((M2i << 8) | (M2i >>> 24)) & 0x00ff00ff) |
            (((M2i << 24) | (M2i >>> 8)) & 0xff00ff00);
          M2i1 =
            (((M2i1 << 8) | (M2i1 >>> 24)) & 0x00ff00ff) |
            (((M2i1 << 24) | (M2i1 >>> 8)) & 0xff00ff00);

          // Absorb message into state
          var lane = state[i];
          lane.high ^= M2i1;
          lane.low ^= M2i;
        }

        // Rounds
        for (var round = 0; round < 24; round++) {
          // Theta
          for (var x = 0; x < 5; x++) {
            // Mix column lanes
            var tMsw = 0,
              tLsw = 0;
            for (var y = 0; y < 5; y++) {
              var lane = state[x + 5 * y];
              tMsw ^= lane.high;
              tLsw ^= lane.low;
            }

            // Temporary values
            var Tx = T[x];
            Tx.high = tMsw;
            Tx.low = tLsw;
          }
          for (var x = 0; x < 5; x++) {
            // Shortcuts
            var Tx4 = T[(x + 4) % 5];
            var Tx1 = T[(x + 1) % 5];
            var Tx1Msw = Tx1.high;
            var Tx1Lsw = Tx1.low;

            // Mix surrounding columns
            var tMsw = Tx4.high ^ ((Tx1Msw << 1) | (Tx1Lsw >>> 31));
            var tLsw = Tx4.low ^ ((Tx1Lsw << 1) | (Tx1Msw >>> 31));
            for (var y = 0; y < 5; y++) {
              var lane = state[x + 5 * y];
              lane.high ^= tMsw;
              lane.low ^= tLsw;
            }
          }

          // Rho Pi
          for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
            var tMsw;
            var tLsw;

            // Shortcuts
            var lane = state[laneIndex];
            var laneMsw = lane.high;
            var laneLsw = lane.low;
            var rhoOffset = RHO_OFFSETS[laneIndex];

            // Rotate lanes
            if (rhoOffset < 32) {
              tMsw = (laneMsw << rhoOffset) | (laneLsw >>> (32 - rhoOffset));
              tLsw = (laneLsw << rhoOffset) | (laneMsw >>> (32 - rhoOffset));
            } /* if (rhoOffset >= 32) */ else {
              tMsw =
                (laneLsw << (rhoOffset - 32)) | (laneMsw >>> (64 - rhoOffset));
              tLsw =
                (laneMsw << (rhoOffset - 32)) | (laneLsw >>> (64 - rhoOffset));
            }

            // Transpose lanes
            var TPiLane = T[PI_INDEXES[laneIndex]];
            TPiLane.high = tMsw;
            TPiLane.low = tLsw;
          }

          // Rho pi at x = y = 0
          var T0 = T[0];
          var state0 = state[0];
          T0.high = state0.high;
          T0.low = state0.low;

          // Chi
          for (var x = 0; x < 5; x++) {
            for (var y = 0; y < 5; y++) {
              // Shortcuts
              var laneIndex = x + 5 * y;
              var lane = state[laneIndex];
              var TLane = T[laneIndex];
              var Tx1Lane = T[((x + 1) % 5) + 5 * y];
              var Tx2Lane = T[((x + 2) % 5) + 5 * y];

              // Mix rows
              lane.high = TLane.high ^ (~Tx1Lane.high & Tx2Lane.high);
              lane.low = TLane.low ^ (~Tx1Lane.low & Tx2Lane.low);
            }
          }

          // Iota
          var lane = state[0];
          var roundConstant = ROUND_CONSTANTS[round];
          lane.high ^= roundConstant.high;
          lane.low ^= roundConstant.low;
        }
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;
        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;
        var blockSizeBits = this.blockSize * 32;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x1 << (24 - (nBitsLeft % 32));
        dataWords[
          ((Math.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits) >>> 5) -
            1
        ] |= 0x80;
        data.sigBytes = dataWords.length * 4;

        // Hash final blocks
        this._process();

        // Shortcuts
        var state = this._state;
        var outputLengthBytes = this.cfg.outputLength / 8;
        var outputLengthLanes = outputLengthBytes / 8;

        // Squeeze
        var hashWords = [];
        for (var i = 0; i < outputLengthLanes; i++) {
          // Shortcuts
          var lane = state[i];
          var laneMsw = lane.high;
          var laneLsw = lane.low;

          // Swap endian
          laneMsw =
            (((laneMsw << 8) | (laneMsw >>> 24)) & 0x00ff00ff) |
            (((laneMsw << 24) | (laneMsw >>> 8)) & 0xff00ff00);
          laneLsw =
            (((laneLsw << 8) | (laneLsw >>> 24)) & 0x00ff00ff) |
            (((laneLsw << 24) | (laneLsw >>> 8)) & 0xff00ff00);

          // Squeeze state to retrieve hash
          hashWords.push(laneLsw);
          hashWords.push(laneMsw);
        }

        // Return final computed hash
        return new WordArray.init(hashWords, outputLengthBytes);
      },

      clone: function () {
        var clone = Hasher.clone.call(this);

        var state = (clone._state = this._state.slice(0));
        for (var i = 0; i < 25; i++) {
          state[i] = state[i].clone();
        }

        return clone;
      },
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA3('message');
     *     var hash = CryptoJS.SHA3(wordArray);
     */
    C.SHA3 = Hasher._createHelper(SHA3);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA3(message, key);
     */
    C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
  })(Math);

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Hasher = C_lib.Hasher;
    var C_x64 = C.x64;
    var X64Word = C_x64.Word;
    var X64WordArray = C_x64.WordArray;
    var C_algo = C.algo;

    function X64Word_create() {
      return X64Word.create.apply(X64Word, arguments);
    }

    // Constants
    var K = [
      X64Word_create(0x428a2f98, 0xd728ae22),
      X64Word_create(0x71374491, 0x23ef65cd),
      X64Word_create(0xb5c0fbcf, 0xec4d3b2f),
      X64Word_create(0xe9b5dba5, 0x8189dbbc),
      X64Word_create(0x3956c25b, 0xf348b538),
      X64Word_create(0x59f111f1, 0xb605d019),
      X64Word_create(0x923f82a4, 0xaf194f9b),
      X64Word_create(0xab1c5ed5, 0xda6d8118),
      X64Word_create(0xd807aa98, 0xa3030242),
      X64Word_create(0x12835b01, 0x45706fbe),
      X64Word_create(0x243185be, 0x4ee4b28c),
      X64Word_create(0x550c7dc3, 0xd5ffb4e2),
      X64Word_create(0x72be5d74, 0xf27b896f),
      X64Word_create(0x80deb1fe, 0x3b1696b1),
      X64Word_create(0x9bdc06a7, 0x25c71235),
      X64Word_create(0xc19bf174, 0xcf692694),
      X64Word_create(0xe49b69c1, 0x9ef14ad2),
      X64Word_create(0xefbe4786, 0x384f25e3),
      X64Word_create(0x0fc19dc6, 0x8b8cd5b5),
      X64Word_create(0x240ca1cc, 0x77ac9c65),
      X64Word_create(0x2de92c6f, 0x592b0275),
      X64Word_create(0x4a7484aa, 0x6ea6e483),
      X64Word_create(0x5cb0a9dc, 0xbd41fbd4),
      X64Word_create(0x76f988da, 0x831153b5),
      X64Word_create(0x983e5152, 0xee66dfab),
      X64Word_create(0xa831c66d, 0x2db43210),
      X64Word_create(0xb00327c8, 0x98fb213f),
      X64Word_create(0xbf597fc7, 0xbeef0ee4),
      X64Word_create(0xc6e00bf3, 0x3da88fc2),
      X64Word_create(0xd5a79147, 0x930aa725),
      X64Word_create(0x06ca6351, 0xe003826f),
      X64Word_create(0x14292967, 0x0a0e6e70),
      X64Word_create(0x27b70a85, 0x46d22ffc),
      X64Word_create(0x2e1b2138, 0x5c26c926),
      X64Word_create(0x4d2c6dfc, 0x5ac42aed),
      X64Word_create(0x53380d13, 0x9d95b3df),
      X64Word_create(0x650a7354, 0x8baf63de),
      X64Word_create(0x766a0abb, 0x3c77b2a8),
      X64Word_create(0x81c2c92e, 0x47edaee6),
      X64Word_create(0x92722c85, 0x1482353b),
      X64Word_create(0xa2bfe8a1, 0x4cf10364),
      X64Word_create(0xa81a664b, 0xbc423001),
      X64Word_create(0xc24b8b70, 0xd0f89791),
      X64Word_create(0xc76c51a3, 0x0654be30),
      X64Word_create(0xd192e819, 0xd6ef5218),
      X64Word_create(0xd6990624, 0x5565a910),
      X64Word_create(0xf40e3585, 0x5771202a),
      X64Word_create(0x106aa070, 0x32bbd1b8),
      X64Word_create(0x19a4c116, 0xb8d2d0c8),
      X64Word_create(0x1e376c08, 0x5141ab53),
      X64Word_create(0x2748774c, 0xdf8eeb99),
      X64Word_create(0x34b0bcb5, 0xe19b48a8),
      X64Word_create(0x391c0cb3, 0xc5c95a63),
      X64Word_create(0x4ed8aa4a, 0xe3418acb),
      X64Word_create(0x5b9cca4f, 0x7763e373),
      X64Word_create(0x682e6ff3, 0xd6b2b8a3),
      X64Word_create(0x748f82ee, 0x5defb2fc),
      X64Word_create(0x78a5636f, 0x43172f60),
      X64Word_create(0x84c87814, 0xa1f0ab72),
      X64Word_create(0x8cc70208, 0x1a6439ec),
      X64Word_create(0x90befffa, 0x23631e28),
      X64Word_create(0xa4506ceb, 0xde82bde9),
      X64Word_create(0xbef9a3f7, 0xb2c67915),
      X64Word_create(0xc67178f2, 0xe372532b),
      X64Word_create(0xca273ece, 0xea26619c),
      X64Word_create(0xd186b8c7, 0x21c0c207),
      X64Word_create(0xeada7dd6, 0xcde0eb1e),
      X64Word_create(0xf57d4f7f, 0xee6ed178),
      X64Word_create(0x06f067aa, 0x72176fba),
      X64Word_create(0x0a637dc5, 0xa2c898a6),
      X64Word_create(0x113f9804, 0xbef90dae),
      X64Word_create(0x1b710b35, 0x131c471b),
      X64Word_create(0x28db77f5, 0x23047d84),
      X64Word_create(0x32caab7b, 0x40c72493),
      X64Word_create(0x3c9ebe0a, 0x15c9bebc),
      X64Word_create(0x431d67c4, 0x9c100d4c),
      X64Word_create(0x4cc5d4be, 0xcb3e42b6),
      X64Word_create(0x597f299c, 0xfc657e2a),
      X64Word_create(0x5fcb6fab, 0x3ad6faec),
      X64Word_create(0x6c44198c, 0x4a475817),
    ];

    // Reusable objects
    var W = [];
    (function () {
      for (var i = 0; i < 80; i++) {
        W[i] = X64Word_create();
      }
    })();

    /**
     * SHA-512 hash algorithm.
     */
    var SHA512 = (C_algo.SHA512 = Hasher.extend({
      _doReset: function () {
        this._hash = new X64WordArray.init([
          new X64Word.init(0x6a09e667, 0xf3bcc908),
          new X64Word.init(0xbb67ae85, 0x84caa73b),
          new X64Word.init(0x3c6ef372, 0xfe94f82b),
          new X64Word.init(0xa54ff53a, 0x5f1d36f1),
          new X64Word.init(0x510e527f, 0xade682d1),
          new X64Word.init(0x9b05688c, 0x2b3e6c1f),
          new X64Word.init(0x1f83d9ab, 0xfb41bd6b),
          new X64Word.init(0x5be0cd19, 0x137e2179),
        ]);
      },

      _doProcessBlock: function (M, offset) {
        // Shortcuts
        var H = this._hash.words;

        var H0 = H[0];
        var H1 = H[1];
        var H2 = H[2];
        var H3 = H[3];
        var H4 = H[4];
        var H5 = H[5];
        var H6 = H[6];
        var H7 = H[7];

        var H0h = H0.high;
        var H0l = H0.low;
        var H1h = H1.high;
        var H1l = H1.low;
        var H2h = H2.high;
        var H2l = H2.low;
        var H3h = H3.high;
        var H3l = H3.low;
        var H4h = H4.high;
        var H4l = H4.low;
        var H5h = H5.high;
        var H5l = H5.low;
        var H6h = H6.high;
        var H6l = H6.low;
        var H7h = H7.high;
        var H7l = H7.low;

        // Working variables
        var ah = H0h;
        var al = H0l;
        var bh = H1h;
        var bl = H1l;
        var ch = H2h;
        var cl = H2l;
        var dh = H3h;
        var dl = H3l;
        var eh = H4h;
        var el = H4l;
        var fh = H5h;
        var fl = H5l;
        var gh = H6h;
        var gl = H6l;
        var hh = H7h;
        var hl = H7l;

        // Rounds
        for (var i = 0; i < 80; i++) {
          var Wil;
          var Wih;

          // Shortcut
          var Wi = W[i];

          // Extend message
          if (i < 16) {
            Wih = Wi.high = M[offset + i * 2] | 0;
            Wil = Wi.low = M[offset + i * 2 + 1] | 0;
          } else {
            // Gamma0
            var gamma0x = W[i - 15];
            var gamma0xh = gamma0x.high;
            var gamma0xl = gamma0x.low;
            var gamma0h =
              ((gamma0xh >>> 1) | (gamma0xl << 31)) ^
              ((gamma0xh >>> 8) | (gamma0xl << 24)) ^
              (gamma0xh >>> 7);
            var gamma0l =
              ((gamma0xl >>> 1) | (gamma0xh << 31)) ^
              ((gamma0xl >>> 8) | (gamma0xh << 24)) ^
              ((gamma0xl >>> 7) | (gamma0xh << 25));

            // Gamma1
            var gamma1x = W[i - 2];
            var gamma1xh = gamma1x.high;
            var gamma1xl = gamma1x.low;
            var gamma1h =
              ((gamma1xh >>> 19) | (gamma1xl << 13)) ^
              ((gamma1xh << 3) | (gamma1xl >>> 29)) ^
              (gamma1xh >>> 6);
            var gamma1l =
              ((gamma1xl >>> 19) | (gamma1xh << 13)) ^
              ((gamma1xl << 3) | (gamma1xh >>> 29)) ^
              ((gamma1xl >>> 6) | (gamma1xh << 26));

            // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
            var Wi7 = W[i - 7];
            var Wi7h = Wi7.high;
            var Wi7l = Wi7.low;

            var Wi16 = W[i - 16];
            var Wi16h = Wi16.high;
            var Wi16l = Wi16.low;

            Wil = gamma0l + Wi7l;
            Wih = gamma0h + Wi7h + (Wil >>> 0 < gamma0l >>> 0 ? 1 : 0);
            Wil = Wil + gamma1l;
            Wih = Wih + gamma1h + (Wil >>> 0 < gamma1l >>> 0 ? 1 : 0);
            Wil = Wil + Wi16l;
            Wih = Wih + Wi16h + (Wil >>> 0 < Wi16l >>> 0 ? 1 : 0);

            Wi.high = Wih;
            Wi.low = Wil;
          }

          var chh = (eh & fh) ^ (~eh & gh);
          var chl = (el & fl) ^ (~el & gl);
          var majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
          var majl = (al & bl) ^ (al & cl) ^ (bl & cl);

          var sigma0h =
            ((ah >>> 28) | (al << 4)) ^
            ((ah << 30) | (al >>> 2)) ^
            ((ah << 25) | (al >>> 7));
          var sigma0l =
            ((al >>> 28) | (ah << 4)) ^
            ((al << 30) | (ah >>> 2)) ^
            ((al << 25) | (ah >>> 7));
          var sigma1h =
            ((eh >>> 14) | (el << 18)) ^
            ((eh >>> 18) | (el << 14)) ^
            ((eh << 23) | (el >>> 9));
          var sigma1l =
            ((el >>> 14) | (eh << 18)) ^
            ((el >>> 18) | (eh << 14)) ^
            ((el << 23) | (eh >>> 9));

          // t1 = h + sigma1 + ch + K[i] + W[i]
          var Ki = K[i];
          var Kih = Ki.high;
          var Kil = Ki.low;

          var t1l = hl + sigma1l;
          var t1h = hh + sigma1h + (t1l >>> 0 < hl >>> 0 ? 1 : 0);
          var t1l = t1l + chl;
          var t1h = t1h + chh + (t1l >>> 0 < chl >>> 0 ? 1 : 0);
          var t1l = t1l + Kil;
          var t1h = t1h + Kih + (t1l >>> 0 < Kil >>> 0 ? 1 : 0);
          var t1l = t1l + Wil;
          var t1h = t1h + Wih + (t1l >>> 0 < Wil >>> 0 ? 1 : 0);

          // t2 = sigma0 + maj
          var t2l = sigma0l + majl;
          var t2h = sigma0h + majh + (t2l >>> 0 < sigma0l >>> 0 ? 1 : 0);

          // Update working variables
          hh = gh;
          hl = gl;
          gh = fh;
          gl = fl;
          fh = eh;
          fl = el;
          el = (dl + t1l) | 0;
          eh = (dh + t1h + (el >>> 0 < dl >>> 0 ? 1 : 0)) | 0;
          dh = ch;
          dl = cl;
          ch = bh;
          cl = bl;
          bh = ah;
          bl = al;
          al = (t1l + t2l) | 0;
          ah = (t1h + t2h + (al >>> 0 < t1l >>> 0 ? 1 : 0)) | 0;
        }

        // Intermediate hash value
        H0l = H0.low = H0l + al;
        H0.high = H0h + ah + (H0l >>> 0 < al >>> 0 ? 1 : 0);
        H1l = H1.low = H1l + bl;
        H1.high = H1h + bh + (H1l >>> 0 < bl >>> 0 ? 1 : 0);
        H2l = H2.low = H2l + cl;
        H2.high = H2h + ch + (H2l >>> 0 < cl >>> 0 ? 1 : 0);
        H3l = H3.low = H3l + dl;
        H3.high = H3h + dh + (H3l >>> 0 < dl >>> 0 ? 1 : 0);
        H4l = H4.low = H4l + el;
        H4.high = H4h + eh + (H4l >>> 0 < el >>> 0 ? 1 : 0);
        H5l = H5.low = H5l + fl;
        H5.high = H5h + fh + (H5l >>> 0 < fl >>> 0 ? 1 : 0);
        H6l = H6.low = H6l + gl;
        H6.high = H6h + gh + (H6l >>> 0 < gl >>> 0 ? 1 : 0);
        H7l = H7.low = H7l + hl;
        H7.high = H7h + hh + (H7l >>> 0 < hl >>> 0 ? 1 : 0);
      },

      _doFinalize: function () {
        // Shortcuts
        var data = this._data;
        var dataWords = data.words;

        var nBitsTotal = this._nDataBytes * 8;
        var nBitsLeft = data.sigBytes * 8;

        // Add padding
        dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));
        dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 30] = Math.floor(
          nBitsTotal / 0x100000000
        );
        dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 31] = nBitsTotal;
        data.sigBytes = dataWords.length * 4;

        // Hash final blocks
        this._process();

        // Convert hash to 32-bit word array before returning
        var hash = this._hash.toX32();

        // Return final computed hash
        return hash;
      },

      clone: function () {
        var clone = Hasher.clone.call(this);
        clone._hash = this._hash.clone();

        return clone;
      },

      blockSize: 1024 / 32,
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA512('message');
     *     var hash = CryptoJS.SHA512(wordArray);
     */
    C.SHA512 = Hasher._createHelper(SHA512);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA512(message, key);
     */
    C.HmacSHA512 = Hasher._createHmacHelper(SHA512);
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_x64 = C.x64;
    var X64Word = C_x64.Word;
    var X64WordArray = C_x64.WordArray;
    var C_algo = C.algo;
    var SHA512 = C_algo.SHA512;

    /**
     * SHA-384 hash algorithm.
     */
    var SHA384 = (C_algo.SHA384 = SHA512.extend({
      _doReset: function () {
        this._hash = new X64WordArray.init([
          new X64Word.init(0xcbbb9d5d, 0xc1059ed8),
          new X64Word.init(0x629a292a, 0x367cd507),
          new X64Word.init(0x9159015a, 0x3070dd17),
          new X64Word.init(0x152fecd8, 0xf70e5939),
          new X64Word.init(0x67332667, 0xffc00b31),
          new X64Word.init(0x8eb44a87, 0x68581511),
          new X64Word.init(0xdb0c2e0d, 0x64f98fa7),
          new X64Word.init(0x47b5481d, 0xbefa4fa4),
        ]);
      },

      _doFinalize: function () {
        var hash = SHA512._doFinalize.call(this);

        hash.sigBytes -= 16;

        return hash;
      },
    }));

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA384('message');
     *     var hash = CryptoJS.SHA384(wordArray);
     */
    C.SHA384 = SHA512._createHelper(SHA384);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA384(message, key);
     */
    C.HmacSHA384 = SHA512._createHmacHelper(SHA384);
  })();

  /**
   * Cipher core components.
   */
  CryptoJS.lib.Cipher ||
    (function (undefined) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var WordArray = C_lib.WordArray;
      var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
      var C_enc = C.enc;
      var Utf8 = C_enc.Utf8;
      var Base64 = C_enc.Base64;
      var C_algo = C.algo;
      var EvpKDF = C_algo.EvpKDF;

      /**
       * Abstract base cipher template.
       *
       * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
       * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
       * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
       * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
       */
      var Cipher = (C_lib.Cipher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         *
         * @property {WordArray} iv The IV to use for this operation.
         */
        cfg: Base.extend(),

        /**
         * Creates this cipher in encryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
         */
        createEncryptor: function (key, cfg) {
          return this.create(this._ENC_XFORM_MODE, key, cfg);
        },

        /**
         * Creates this cipher in decryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
         */
        createDecryptor: function (key, cfg) {
          return this.create(this._DEC_XFORM_MODE, key, cfg);
        },

        /**
         * Initializes a newly created cipher.
         *
         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
         */
        init: function (xformMode, key, cfg) {
          // Apply config defaults
          this.cfg = this.cfg.extend(cfg);

          // Store transform mode and key
          this._xformMode = xformMode;
          this._key = key;

          // Set initial values
          this.reset();
        },

        /**
         * Resets this cipher to its initial state.
         *
         * @example
         *
         *     cipher.reset();
         */
        reset: function () {
          // Reset data buffer
          BufferedBlockAlgorithm.reset.call(this);

          // Perform concrete-cipher logic
          this._doReset();
        },

        /**
         * Adds data to be encrypted or decrypted.
         *
         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
         *
         * @return {WordArray} The data after processing.
         *
         * @example
         *
         *     var encrypted = cipher.process('data');
         *     var encrypted = cipher.process(wordArray);
         */
        process: function (dataUpdate) {
          // Append
          this._append(dataUpdate);

          // Process available blocks
          return this._process();
        },

        /**
         * Finalizes the encryption or decryption process.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
         *
         * @return {WordArray} The data after final processing.
         *
         * @example
         *
         *     var encrypted = cipher.finalize();
         *     var encrypted = cipher.finalize('data');
         *     var encrypted = cipher.finalize(wordArray);
         */
        finalize: function (dataUpdate) {
          // Final data update
          if (dataUpdate) {
            this._append(dataUpdate);
          }

          // Perform concrete-cipher logic
          var finalProcessedData = this._doFinalize();

          return finalProcessedData;
        },

        keySize: 128 / 32,

        ivSize: 128 / 32,

        _ENC_XFORM_MODE: 1,

        _DEC_XFORM_MODE: 2,

        /**
         * Creates shortcut functions to a cipher's object interface.
         *
         * @param {Cipher} cipher The cipher to create a helper for.
         *
         * @return {Object} An object with encrypt and decrypt shortcut functions.
         *
         * @static
         *
         * @example
         *
         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
         */
        _createHelper: (function () {
          function selectCipherStrategy(key) {
            if (typeof key == "string") {
              return PasswordBasedCipher;
            } else {
              return SerializableCipher;
            }
          }

          return function (cipher) {
            return {
              encrypt: function (message, key, cfg) {
                return selectCipherStrategy(key).encrypt(
                  cipher,
                  message,
                  key,
                  cfg
                );
              },

              decrypt: function (ciphertext, key, cfg) {
                return selectCipherStrategy(key).decrypt(
                  cipher,
                  ciphertext,
                  key,
                  cfg
                );
              },
            };
          };
        })(),
      }));

      /**
       * Abstract base stream cipher template.
       *
       * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
       */
      var StreamCipher = (C_lib.StreamCipher = Cipher.extend({
        _doFinalize: function () {
          // Process partial blocks
          var finalProcessedBlocks = this._process(!!"flush");

          return finalProcessedBlocks;
        },

        blockSize: 1,
      }));

      /**
       * Mode namespace.
       */
      var C_mode = (C.mode = {});

      /**
       * Abstract base block cipher mode template.
       */
      var BlockCipherMode = (C_lib.BlockCipherMode = Base.extend({
        /**
         * Creates this mode for encryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
         */
        createEncryptor: function (cipher, iv) {
          return this.Encryptor.create(cipher, iv);
        },

        /**
         * Creates this mode for decryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
         */
        createDecryptor: function (cipher, iv) {
          return this.Decryptor.create(cipher, iv);
        },

        /**
         * Initializes a newly created mode.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
         */
        init: function (cipher, iv) {
          this._cipher = cipher;
          this._iv = iv;
        },
      }));

      /**
       * Cipher Block Chaining mode.
       */
      var CBC = (C_mode.CBC = (function () {
        /**
         * Abstract base CBC mode.
         */
        var CBC = BlockCipherMode.extend();

        /**
         * CBC encryptor.
         */
        CBC.Encryptor = CBC.extend({
          /**
           * Processes the data block at offset.
           *
           * @param {Array} words The data words to operate on.
           * @param {number} offset The offset where the block starts.
           *
           * @example
           *
           *     mode.processBlock(data.words, offset);
           */
          processBlock: function (words, offset) {
            // Shortcuts
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;

            // XOR and encrypt
            xorBlock.call(this, words, offset, blockSize);
            cipher.encryptBlock(words, offset);

            // Remember this block to use with next block
            this._prevBlock = words.slice(offset, offset + blockSize);
          },
        });

        /**
         * CBC decryptor.
         */
        CBC.Decryptor = CBC.extend({
          /**
           * Processes the data block at offset.
           *
           * @param {Array} words The data words to operate on.
           * @param {number} offset The offset where the block starts.
           *
           * @example
           *
           *     mode.processBlock(data.words, offset);
           */
          processBlock: function (words, offset) {
            // Shortcuts
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;

            // Remember this block to use with next block
            var thisBlock = words.slice(offset, offset + blockSize);

            // Decrypt and XOR
            cipher.decryptBlock(words, offset);
            xorBlock.call(this, words, offset, blockSize);

            // This block becomes the previous block
            this._prevBlock = thisBlock;
          },
        });

        function xorBlock(words, offset, blockSize) {
          var block;

          // Shortcut
          var iv = this._iv;

          // Choose mixing block
          if (iv) {
            block = iv;

            // Remove IV for subsequent blocks
            this._iv = undefined;
          } else {
            block = this._prevBlock;
          }

          // XOR blocks
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= block[i];
          }
        }

        return CBC;
      })());

      /**
       * Padding namespace.
       */
      var C_pad = (C.pad = {});

      /**
       * PKCS #5/7 padding strategy.
       */
      var Pkcs7 = (C_pad.Pkcs7 = {
        /**
         * Pads data using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to pad.
         * @param {number} blockSize The multiple that the data should be padded to.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
         */
        pad: function (data, blockSize) {
          // Shortcut
          var blockSizeBytes = blockSize * 4;

          // Count padding bytes
          var nPaddingBytes = blockSizeBytes - (data.sigBytes % blockSizeBytes);

          // Create padding word
          var paddingWord =
            (nPaddingBytes << 24) |
            (nPaddingBytes << 16) |
            (nPaddingBytes << 8) |
            nPaddingBytes;

          // Create padding
          var paddingWords = [];
          for (var i = 0; i < nPaddingBytes; i += 4) {
            paddingWords.push(paddingWord);
          }
          var padding = WordArray.create(paddingWords, nPaddingBytes);

          // Add padding
          data.concat(padding);
        },

        /**
         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to unpad.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
         */
        unpad: function (data) {
          // Get number of padding bytes from last byte
          var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

          // Remove padding
          data.sigBytes -= nPaddingBytes;
        },
      });

      /**
       * Abstract base block cipher template.
       *
       * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
       */
      var BlockCipher = (C_lib.BlockCipher = Cipher.extend({
        /**
         * Configuration options.
         *
         * @property {Mode} mode The block mode to use. Default: CBC
         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
         */
        cfg: Cipher.cfg.extend({
          mode: CBC,
          padding: Pkcs7,
        }),

        reset: function () {
          var modeCreator;

          // Reset cipher
          Cipher.reset.call(this);

          // Shortcuts
          var cfg = this.cfg;
          var iv = cfg.iv;
          var mode = cfg.mode;

          // Reset block mode
          if (this._xformMode == this._ENC_XFORM_MODE) {
            modeCreator = mode.createEncryptor;
          } /* if (this._xformMode == this._DEC_XFORM_MODE) */ else {
            modeCreator = mode.createDecryptor;
            // Keep at least one block in the buffer for unpadding
            this._minBufferSize = 1;
          }

          if (this._mode && this._mode.__creator == modeCreator) {
            this._mode.init(this, iv && iv.words);
          } else {
            this._mode = modeCreator.call(mode, this, iv && iv.words);
            this._mode.__creator = modeCreator;
          }
        },

        _doProcessBlock: function (words, offset) {
          this._mode.processBlock(words, offset);
        },

        _doFinalize: function () {
          var finalProcessedBlocks;

          // Shortcut
          var padding = this.cfg.padding;

          // Finalize
          if (this._xformMode == this._ENC_XFORM_MODE) {
            // Pad data
            padding.pad(this._data, this.blockSize);

            // Process final blocks
            finalProcessedBlocks = this._process(!!"flush");
          } /* if (this._xformMode == this._DEC_XFORM_MODE) */ else {
            // Process final blocks
            finalProcessedBlocks = this._process(!!"flush");

            // Unpad data
            padding.unpad(finalProcessedBlocks);
          }

          return finalProcessedBlocks;
        },

        blockSize: 128 / 32,
      }));

      /**
       * A collection of cipher parameters.
       *
       * @property {WordArray} ciphertext The raw ciphertext.
       * @property {WordArray} key The key to this ciphertext.
       * @property {WordArray} iv The IV used in the ciphering operation.
       * @property {WordArray} salt The salt used with a key derivation function.
       * @property {Cipher} algorithm The cipher algorithm.
       * @property {Mode} mode The block mode used in the ciphering operation.
       * @property {Padding} padding The padding scheme used in the ciphering operation.
       * @property {number} blockSize The block size of the cipher.
       * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
       */
      var CipherParams = (C_lib.CipherParams = Base.extend({
        /**
         * Initializes a newly created cipher params object.
         *
         * @param {Object} cipherParams An object with any of the possible cipher parameters.
         *
         * @example
         *
         *     var cipherParams = CryptoJS.lib.CipherParams.create({
         *         ciphertext: ciphertextWordArray,
         *         key: keyWordArray,
         *         iv: ivWordArray,
         *         salt: saltWordArray,
         *         algorithm: CryptoJS.algo.AES,
         *         mode: CryptoJS.mode.CBC,
         *         padding: CryptoJS.pad.PKCS7,
         *         blockSize: 4,
         *         formatter: CryptoJS.format.OpenSSL
         *     });
         */
        init: function (cipherParams) {
          this.mixIn(cipherParams);
        },

        /**
         * Converts this cipher params object to a string.
         *
         * @param {Format} formatter (Optional) The formatting strategy to use.
         *
         * @return {string} The stringified cipher params.
         *
         * @throws Error If neither the formatter nor the default formatter is set.
         *
         * @example
         *
         *     var string = cipherParams + '';
         *     var string = cipherParams.toString();
         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
         */
        toString: function (formatter) {
          return (formatter || this.formatter).stringify(this);
        },
      }));

      /**
       * Format namespace.
       */
      var C_format = (C.format = {});

      /**
       * OpenSSL formatting strategy.
       */
      var OpenSSLFormatter = (C_format.OpenSSL = {
        /**
         * Converts a cipher params object to an OpenSSL-compatible string.
         *
         * @param {CipherParams} cipherParams The cipher params object.
         *
         * @return {string} The OpenSSL-compatible string.
         *
         * @static
         *
         * @example
         *
         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
         */
        stringify: function (cipherParams) {
          var wordArray;

          // Shortcuts
          var ciphertext = cipherParams.ciphertext;
          var salt = cipherParams.salt;

          // Format
          if (salt) {
            wordArray = WordArray.create([0x53616c74, 0x65645f5f])
              .concat(salt)
              .concat(ciphertext);
          } else {
            wordArray = ciphertext;
          }

          return wordArray.toString(Base64);
        },

        /**
         * Converts an OpenSSL-compatible string to a cipher params object.
         *
         * @param {string} openSSLStr The OpenSSL-compatible string.
         *
         * @return {CipherParams} The cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
         */
        parse: function (openSSLStr) {
          var salt;

          // Parse base64
          var ciphertext = Base64.parse(openSSLStr);

          // Shortcut
          var ciphertextWords = ciphertext.words;

          // Test for salt
          if (
            ciphertextWords[0] == 0x53616c74 &&
            ciphertextWords[1] == 0x65645f5f
          ) {
            // Extract salt
            salt = WordArray.create(ciphertextWords.slice(2, 4));

            // Remove salt from ciphertext
            ciphertextWords.splice(0, 4);
            ciphertext.sigBytes -= 16;
          }

          return CipherParams.create({ ciphertext: ciphertext, salt: salt });
        },
      });

      /**
       * A cipher wrapper that returns ciphertext as a serializable cipher params object.
       */
      var SerializableCipher = (C_lib.SerializableCipher = Base.extend({
        /**
         * Configuration options.
         *
         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
         */
        cfg: Base.extend({
          format: OpenSSLFormatter,
        }),

        /**
         * Encrypts a message.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {WordArray|string} message The message to encrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CipherParams} A cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        encrypt: function (cipher, message, key, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Encrypt
          var encryptor = cipher.createEncryptor(key, cfg);
          var ciphertext = encryptor.finalize(message);

          // Shortcut
          var cipherCfg = encryptor.cfg;

          // Create and return serializable cipher params
          return CipherParams.create({
            ciphertext: ciphertext,
            key: key,
            iv: cipherCfg.iv,
            algorithm: cipher,
            mode: cipherCfg.mode,
            padding: cipherCfg.padding,
            blockSize: cipher.blockSize,
            formatter: cfg.format,
          });
        },

        /**
         * Decrypts serialized ciphertext.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {WordArray} The plaintext.
         *
         * @static
         *
         * @example
         *
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        decrypt: function (cipher, ciphertext, key, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Convert string to CipherParams
          ciphertext = this._parse(ciphertext, cfg.format);

          // Decrypt
          var plaintext = cipher
            .createDecryptor(key, cfg)
            .finalize(ciphertext.ciphertext);

          return plaintext;
        },

        /**
         * Converts serialized ciphertext to CipherParams,
         * else assumed CipherParams already and returns ciphertext unchanged.
         *
         * @param {CipherParams|string} ciphertext The ciphertext.
         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
         *
         * @return {CipherParams} The unserialized ciphertext.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
         */
        _parse: function (ciphertext, format) {
          if (typeof ciphertext == "string") {
            return format.parse(ciphertext, this);
          } else {
            return ciphertext;
          }
        },
      }));

      /**
       * Key derivation function namespace.
       */
      var C_kdf = (C.kdf = {});

      /**
       * OpenSSL key derivation function.
       */
      var OpenSSLKdf = (C_kdf.OpenSSL = {
        /**
         * Derives a key and IV from a password.
         *
         * @param {string} password The password to derive from.
         * @param {number} keySize The size in words of the key to generate.
         * @param {number} ivSize The size in words of the IV to generate.
         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
         *
         * @return {CipherParams} A cipher params object with the key, IV, and salt.
         *
         * @static
         *
         * @example
         *
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
         */
        execute: function (password, keySize, ivSize, salt) {
          // Generate random salt
          if (!salt) {
            salt = WordArray.random(64 / 8);
          }

          // Derive key and IV
          var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(
            password,
            salt
          );

          // Separate key and IV
          var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
          key.sigBytes = keySize * 4;

          // Return params
          return CipherParams.create({ key: key, iv: iv, salt: salt });
        },
      });

      /**
       * A serializable cipher wrapper that derives the key from a password,
       * and returns ciphertext as a serializable cipher params object.
       */
      var PasswordBasedCipher = (C_lib.PasswordBasedCipher =
        SerializableCipher.extend({
          /**
           * Configuration options.
           *
           * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
           */
          cfg: SerializableCipher.cfg.extend({
            kdf: OpenSSLKdf,
          }),

          /**
           * Encrypts a message using a password.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {WordArray|string} message The message to encrypt.
           * @param {string} password The password.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {CipherParams} A cipher params object.
           *
           * @static
           *
           * @example
           *
           *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
           *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
           */
          encrypt: function (cipher, message, password, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Derive key and other params
            var derivedParams = cfg.kdf.execute(
              password,
              cipher.keySize,
              cipher.ivSize
            );

            // Add IV to config
            cfg.iv = derivedParams.iv;

            // Encrypt
            var ciphertext = SerializableCipher.encrypt.call(
              this,
              cipher,
              message,
              derivedParams.key,
              cfg
            );

            // Mix in derived params
            ciphertext.mixIn(derivedParams);

            return ciphertext;
          },

          /**
           * Decrypts serialized ciphertext using a password.
           *
           * @param {Cipher} cipher The cipher algorithm to use.
           * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
           * @param {string} password The password.
           * @param {Object} cfg (Optional) The configuration options to use for this operation.
           *
           * @return {WordArray} The plaintext.
           *
           * @static
           *
           * @example
           *
           *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
           *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
           */
          decrypt: function (cipher, ciphertext, password, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Convert string to CipherParams
            ciphertext = this._parse(ciphertext, cfg.format);

            // Derive key and other params
            var derivedParams = cfg.kdf.execute(
              password,
              cipher.keySize,
              cipher.ivSize,
              ciphertext.salt
            );

            // Add IV to config
            cfg.iv = derivedParams.iv;

            // Decrypt
            var plaintext = SerializableCipher.decrypt.call(
              this,
              cipher,
              ciphertext,
              derivedParams.key,
              cfg
            );

            return plaintext;
          },
        }));
    })();

  /**
   * Cipher Feedback block mode.
   */
  CryptoJS.mode.CFB = (function () {
    var CFB = CryptoJS.lib.BlockCipherMode.extend();

    CFB.Encryptor = CFB.extend({
      processBlock: function (words, offset) {
        // Shortcuts
        var cipher = this._cipher;
        var blockSize = cipher.blockSize;

        generateKeystreamAndEncrypt.call(
          this,
          words,
          offset,
          blockSize,
          cipher
        );

        // Remember this block to use with next block
        this._prevBlock = words.slice(offset, offset + blockSize);
      },
    });

    CFB.Decryptor = CFB.extend({
      processBlock: function (words, offset) {
        // Shortcuts
        var cipher = this._cipher;
        var blockSize = cipher.blockSize;

        // Remember this block to use with next block
        var thisBlock = words.slice(offset, offset + blockSize);

        generateKeystreamAndEncrypt.call(
          this,
          words,
          offset,
          blockSize,
          cipher
        );

        // This block becomes the previous block
        this._prevBlock = thisBlock;
      },
    });

    function generateKeystreamAndEncrypt(words, offset, blockSize, cipher) {
      var keystream;

      // Shortcut
      var iv = this._iv;

      // Generate keystream
      if (iv) {
        keystream = iv.slice(0);

        // Remove IV for subsequent blocks
        this._iv = undefined;
      } else {
        keystream = this._prevBlock;
      }
      cipher.encryptBlock(keystream, 0);

      // Encrypt
      for (var i = 0; i < blockSize; i++) {
        words[offset + i] ^= keystream[i];
      }
    }

    return CFB;
  })();

  /**
   * Electronic Codebook block mode.
   */
  CryptoJS.mode.ECB = (function () {
    var ECB = CryptoJS.lib.BlockCipherMode.extend();

    ECB.Encryptor = ECB.extend({
      processBlock: function (words, offset) {
        this._cipher.encryptBlock(words, offset);
      },
    });

    ECB.Decryptor = ECB.extend({
      processBlock: function (words, offset) {
        this._cipher.decryptBlock(words, offset);
      },
    });

    return ECB;
  })();

  /**
   * ANSI X.923 padding strategy.
   */
  CryptoJS.pad.AnsiX923 = {
    pad: function (data, blockSize) {
      // Shortcuts
      var dataSigBytes = data.sigBytes;
      var blockSizeBytes = blockSize * 4;

      // Count padding bytes
      var nPaddingBytes = blockSizeBytes - (dataSigBytes % blockSizeBytes);

      // Compute last byte position
      var lastBytePos = dataSigBytes + nPaddingBytes - 1;

      // Pad
      data.clamp();
      data.words[lastBytePos >>> 2] |=
        nPaddingBytes << (24 - (lastBytePos % 4) * 8);
      data.sigBytes += nPaddingBytes;
    },

    unpad: function (data) {
      // Get number of padding bytes from last byte
      var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

      // Remove padding
      data.sigBytes -= nPaddingBytes;
    },
  };

  /**
   * ISO 10126 padding strategy.
   */
  CryptoJS.pad.Iso10126 = {
    pad: function (data, blockSize) {
      // Shortcut
      var blockSizeBytes = blockSize * 4;

      // Count padding bytes
      var nPaddingBytes = blockSizeBytes - (data.sigBytes % blockSizeBytes);

      // Pad
      data
        .concat(CryptoJS.lib.WordArray.random(nPaddingBytes - 1))
        .concat(CryptoJS.lib.WordArray.create([nPaddingBytes << 24], 1));
    },

    unpad: function (data) {
      // Get number of padding bytes from last byte
      var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

      // Remove padding
      data.sigBytes -= nPaddingBytes;
    },
  };

  /**
   * ISO/IEC 9797-1 Padding Method 2.
   */
  CryptoJS.pad.Iso97971 = {
    pad: function (data, blockSize) {
      // Add 0x80 byte
      data.concat(CryptoJS.lib.WordArray.create([0x80000000], 1));

      // Zero pad the rest
      CryptoJS.pad.ZeroPadding.pad(data, blockSize);
    },

    unpad: function (data) {
      // Remove zero padding
      CryptoJS.pad.ZeroPadding.unpad(data);

      // Remove one more byte -- the 0x80 byte
      data.sigBytes--;
    },
  };

  /**
   * Output Feedback block mode.
   */
  CryptoJS.mode.OFB = (function () {
    var OFB = CryptoJS.lib.BlockCipherMode.extend();

    var Encryptor = (OFB.Encryptor = OFB.extend({
      processBlock: function (words, offset) {
        // Shortcuts
        var cipher = this._cipher;
        var blockSize = cipher.blockSize;
        var iv = this._iv;
        var keystream = this._keystream;

        // Generate keystream
        if (iv) {
          keystream = this._keystream = iv.slice(0);

          // Remove IV for subsequent blocks
          this._iv = undefined;
        }
        cipher.encryptBlock(keystream, 0);

        // Encrypt
        for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= keystream[i];
        }
      },
    }));

    OFB.Decryptor = Encryptor;

    return OFB;
  })();

  /**
   * A noop padding strategy.
   */
  CryptoJS.pad.NoPadding = {
    pad: function () {},

    unpad: function () {},
  };

  (function (undefined) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var CipherParams = C_lib.CipherParams;
    var C_enc = C.enc;
    var Hex = C_enc.Hex;
    var C_format = C.format;

    var HexFormatter = (C_format.Hex = {
      /**
       * Converts the ciphertext of a cipher params object to a hexadecimally encoded string.
       *
       * @param {CipherParams} cipherParams The cipher params object.
       *
       * @return {string} The hexadecimally encoded string.
       *
       * @static
       *
       * @example
       *
       *     var hexString = CryptoJS.format.Hex.stringify(cipherParams);
       */
      stringify: function (cipherParams) {
        return cipherParams.ciphertext.toString(Hex);
      },

      /**
       * Converts a hexadecimally encoded ciphertext string to a cipher params object.
       *
       * @param {string} input The hexadecimally encoded string.
       *
       * @return {CipherParams} The cipher params object.
       *
       * @static
       *
       * @example
       *
       *     var cipherParams = CryptoJS.format.Hex.parse(hexString);
       */
      parse: function (input) {
        var ciphertext = Hex.parse(input);
        return CipherParams.create({ ciphertext: ciphertext });
      },
    });
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var BlockCipher = C_lib.BlockCipher;
    var C_algo = C.algo;

    // Lookup tables
    var SBOX = [];
    var INV_SBOX = [];
    var SUB_MIX_0 = [];
    var SUB_MIX_1 = [];
    var SUB_MIX_2 = [];
    var SUB_MIX_3 = [];
    var INV_SUB_MIX_0 = [];
    var INV_SUB_MIX_1 = [];
    var INV_SUB_MIX_2 = [];
    var INV_SUB_MIX_3 = [];

    // Compute lookup tables
    (function () {
      // Compute double table
      var d = [];
      for (var i = 0; i < 256; i++) {
        if (i < 128) {
          d[i] = i << 1;
        } else {
          d[i] = (i << 1) ^ 0x11b;
        }
      }

      // Walk GF(2^8)
      var x = 0;
      var xi = 0;
      for (var i = 0; i < 256; i++) {
        // Compute sbox
        var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
        sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
        SBOX[x] = sx;
        INV_SBOX[sx] = x;

        // Compute multiplication
        var x2 = d[x];
        var x4 = d[x2];
        var x8 = d[x4];

        // Compute sub bytes, mix columns tables
        var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
        SUB_MIX_0[x] = (t << 24) | (t >>> 8);
        SUB_MIX_1[x] = (t << 16) | (t >>> 16);
        SUB_MIX_2[x] = (t << 8) | (t >>> 24);
        SUB_MIX_3[x] = t;

        // Compute inv sub bytes, inv mix columns tables
        var t =
          (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
        INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
        INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
        INV_SUB_MIX_2[sx] = (t << 8) | (t >>> 24);
        INV_SUB_MIX_3[sx] = t;

        // Compute next counter
        if (!x) {
          x = xi = 1;
        } else {
          x = x2 ^ d[d[d[x8 ^ x2]]];
          xi ^= d[d[xi]];
        }
      }
    })();

    // Precomputed Rcon lookup
    var RCON = [
      0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
    ];

    /**
     * AES block cipher algorithm.
     */
    var AES = (C_algo.AES = BlockCipher.extend({
      _doReset: function () {
        var t;

        // Skip reset of nRounds has been set before and key did not change
        if (this._nRounds && this._keyPriorReset === this._key) {
          return;
        }

        // Shortcuts
        var key = (this._keyPriorReset = this._key);
        var keyWords = key.words;
        var keySize = key.sigBytes / 4;

        // Compute number of rounds
        var nRounds = (this._nRounds = keySize + 6);

        // Compute number of key schedule rows
        var ksRows = (nRounds + 1) * 4;

        // Compute key schedule
        var keySchedule = (this._keySchedule = []);
        for (var ksRow = 0; ksRow < ksRows; ksRow++) {
          if (ksRow < keySize) {
            keySchedule[ksRow] = keyWords[ksRow];
          } else {
            t = keySchedule[ksRow - 1];

            if (!(ksRow % keySize)) {
              // Rot word
              t = (t << 8) | (t >>> 24);

              // Sub word
              t =
                (SBOX[t >>> 24] << 24) |
                (SBOX[(t >>> 16) & 0xff] << 16) |
                (SBOX[(t >>> 8) & 0xff] << 8) |
                SBOX[t & 0xff];

              // Mix Rcon
              t ^= RCON[(ksRow / keySize) | 0] << 24;
            } else if (keySize > 6 && ksRow % keySize == 4) {
              // Sub word
              t =
                (SBOX[t >>> 24] << 24) |
                (SBOX[(t >>> 16) & 0xff] << 16) |
                (SBOX[(t >>> 8) & 0xff] << 8) |
                SBOX[t & 0xff];
            }

            keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
          }
        }

        // Compute inv key schedule
        var invKeySchedule = (this._invKeySchedule = []);
        for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
          var ksRow = ksRows - invKsRow;

          if (invKsRow % 4) {
            var t = keySchedule[ksRow];
          } else {
            var t = keySchedule[ksRow - 4];
          }

          if (invKsRow < 4 || ksRow <= 4) {
            invKeySchedule[invKsRow] = t;
          } else {
            invKeySchedule[invKsRow] =
              INV_SUB_MIX_0[SBOX[t >>> 24]] ^
              INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
              INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^
              INV_SUB_MIX_3[SBOX[t & 0xff]];
          }
        }
      },

      encryptBlock: function (M, offset) {
        this._doCryptBlock(
          M,
          offset,
          this._keySchedule,
          SUB_MIX_0,
          SUB_MIX_1,
          SUB_MIX_2,
          SUB_MIX_3,
          SBOX
        );
      },

      decryptBlock: function (M, offset) {
        // Swap 2nd and 4th rows
        var t = M[offset + 1];
        M[offset + 1] = M[offset + 3];
        M[offset + 3] = t;

        this._doCryptBlock(
          M,
          offset,
          this._invKeySchedule,
          INV_SUB_MIX_0,
          INV_SUB_MIX_1,
          INV_SUB_MIX_2,
          INV_SUB_MIX_3,
          INV_SBOX
        );

        // Inv swap 2nd and 4th rows
        var t = M[offset + 1];
        M[offset + 1] = M[offset + 3];
        M[offset + 3] = t;
      },

      _doCryptBlock: function (
        M,
        offset,
        keySchedule,
        SUB_MIX_0,
        SUB_MIX_1,
        SUB_MIX_2,
        SUB_MIX_3,
        SBOX
      ) {
        // Shortcut
        var nRounds = this._nRounds;

        // Get input, add round key
        var s0 = M[offset] ^ keySchedule[0];
        var s1 = M[offset + 1] ^ keySchedule[1];
        var s2 = M[offset + 2] ^ keySchedule[2];
        var s3 = M[offset + 3] ^ keySchedule[3];

        // Key schedule row counter
        var ksRow = 4;

        // Rounds
        for (var round = 1; round < nRounds; round++) {
          // Shift rows, sub bytes, mix columns, add round key
          var t0 =
            SUB_MIX_0[s0 >>> 24] ^
            SUB_MIX_1[(s1 >>> 16) & 0xff] ^
            SUB_MIX_2[(s2 >>> 8) & 0xff] ^
            SUB_MIX_3[s3 & 0xff] ^
            keySchedule[ksRow++];
          var t1 =
            SUB_MIX_0[s1 >>> 24] ^
            SUB_MIX_1[(s2 >>> 16) & 0xff] ^
            SUB_MIX_2[(s3 >>> 8) & 0xff] ^
            SUB_MIX_3[s0 & 0xff] ^
            keySchedule[ksRow++];
          var t2 =
            SUB_MIX_0[s2 >>> 24] ^
            SUB_MIX_1[(s3 >>> 16) & 0xff] ^
            SUB_MIX_2[(s0 >>> 8) & 0xff] ^
            SUB_MIX_3[s1 & 0xff] ^
            keySchedule[ksRow++];
          var t3 =
            SUB_MIX_0[s3 >>> 24] ^
            SUB_MIX_1[(s0 >>> 16) & 0xff] ^
            SUB_MIX_2[(s1 >>> 8) & 0xff] ^
            SUB_MIX_3[s2 & 0xff] ^
            keySchedule[ksRow++];

          // Update state
          s0 = t0;
          s1 = t1;
          s2 = t2;
          s3 = t3;
        }

        // Shift rows, sub bytes, add round key
        var t0 =
          ((SBOX[s0 >>> 24] << 24) |
            (SBOX[(s1 >>> 16) & 0xff] << 16) |
            (SBOX[(s2 >>> 8) & 0xff] << 8) |
            SBOX[s3 & 0xff]) ^
          keySchedule[ksRow++];
        var t1 =
          ((SBOX[s1 >>> 24] << 24) |
            (SBOX[(s2 >>> 16) & 0xff] << 16) |
            (SBOX[(s3 >>> 8) & 0xff] << 8) |
            SBOX[s0 & 0xff]) ^
          keySchedule[ksRow++];
        var t2 =
          ((SBOX[s2 >>> 24] << 24) |
            (SBOX[(s3 >>> 16) & 0xff] << 16) |
            (SBOX[(s0 >>> 8) & 0xff] << 8) |
            SBOX[s1 & 0xff]) ^
          keySchedule[ksRow++];
        var t3 =
          ((SBOX[s3 >>> 24] << 24) |
            (SBOX[(s0 >>> 16) & 0xff] << 16) |
            (SBOX[(s1 >>> 8) & 0xff] << 8) |
            SBOX[s2 & 0xff]) ^
          keySchedule[ksRow++];

        // Set output
        M[offset] = t0;
        M[offset + 1] = t1;
        M[offset + 2] = t2;
        M[offset + 3] = t3;
      },

      keySize: 256 / 32,
    }));

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
     */
    C.AES = BlockCipher._createHelper(AES);
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var BlockCipher = C_lib.BlockCipher;
    var C_algo = C.algo;

    // Permuted Choice 1 constants
    var PC1 = [
      57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43,
      35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54,
      46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4,
    ];

    // Permuted Choice 2 constants
    var PC2 = [
      14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7,
      27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39,
      56, 34, 53, 46, 42, 50, 36, 29, 32,
    ];

    // Cumulative bit shift constants
    var BIT_SHIFTS = [
      1, 2, 4, 6, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28,
    ];

    // SBOXes and round permutation constants
    var SBOX_P = [
      {
        0x0: 0x808200,
        0x10000000: 0x8000,
        0x20000000: 0x808002,
        0x30000000: 0x2,
        0x40000000: 0x200,
        0x50000000: 0x808202,
        0x60000000: 0x800202,
        0x70000000: 0x800000,
        0x80000000: 0x202,
        0x90000000: 0x800200,
        0xa0000000: 0x8200,
        0xb0000000: 0x808000,
        0xc0000000: 0x8002,
        0xd0000000: 0x800002,
        0xe0000000: 0x0,
        0xf0000000: 0x8202,
        0x8000000: 0x0,
        0x18000000: 0x808202,
        0x28000000: 0x8202,
        0x38000000: 0x8000,
        0x48000000: 0x808200,
        0x58000000: 0x200,
        0x68000000: 0x808002,
        0x78000000: 0x2,
        0x88000000: 0x800200,
        0x98000000: 0x8200,
        0xa8000000: 0x808000,
        0xb8000000: 0x800202,
        0xc8000000: 0x800002,
        0xd8000000: 0x8002,
        0xe8000000: 0x202,
        0xf8000000: 0x800000,
        0x1: 0x8000,
        0x10000001: 0x2,
        0x20000001: 0x808200,
        0x30000001: 0x800000,
        0x40000001: 0x808002,
        0x50000001: 0x8200,
        0x60000001: 0x200,
        0x70000001: 0x800202,
        0x80000001: 0x808202,
        0x90000001: 0x808000,
        0xa0000001: 0x800002,
        0xb0000001: 0x8202,
        0xc0000001: 0x202,
        0xd0000001: 0x800200,
        0xe0000001: 0x8002,
        0xf0000001: 0x0,
        0x8000001: 0x808202,
        0x18000001: 0x808000,
        0x28000001: 0x800000,
        0x38000001: 0x200,
        0x48000001: 0x8000,
        0x58000001: 0x800002,
        0x68000001: 0x2,
        0x78000001: 0x8202,
        0x88000001: 0x8002,
        0x98000001: 0x800202,
        0xa8000001: 0x202,
        0xb8000001: 0x808200,
        0xc8000001: 0x800200,
        0xd8000001: 0x0,
        0xe8000001: 0x8200,
        0xf8000001: 0x808002,
      },
      {
        0x0: 0x40084010,
        0x1000000: 0x4000,
        0x2000000: 0x80000,
        0x3000000: 0x40080010,
        0x4000000: 0x40000010,
        0x5000000: 0x40084000,
        0x6000000: 0x40004000,
        0x7000000: 0x10,
        0x8000000: 0x84000,
        0x9000000: 0x40004010,
        0xa000000: 0x40000000,
        0xb000000: 0x84010,
        0xc000000: 0x80010,
        0xd000000: 0x0,
        0xe000000: 0x4010,
        0xf000000: 0x40080000,
        0x800000: 0x40004000,
        0x1800000: 0x84010,
        0x2800000: 0x10,
        0x3800000: 0x40004010,
        0x4800000: 0x40084010,
        0x5800000: 0x40000000,
        0x6800000: 0x80000,
        0x7800000: 0x40080010,
        0x8800000: 0x80010,
        0x9800000: 0x0,
        0xa800000: 0x4000,
        0xb800000: 0x40080000,
        0xc800000: 0x40000010,
        0xd800000: 0x84000,
        0xe800000: 0x40084000,
        0xf800000: 0x4010,
        0x10000000: 0x0,
        0x11000000: 0x40080010,
        0x12000000: 0x40004010,
        0x13000000: 0x40084000,
        0x14000000: 0x40080000,
        0x15000000: 0x10,
        0x16000000: 0x84010,
        0x17000000: 0x4000,
        0x18000000: 0x4010,
        0x19000000: 0x80000,
        0x1a000000: 0x80010,
        0x1b000000: 0x40000010,
        0x1c000000: 0x84000,
        0x1d000000: 0x40004000,
        0x1e000000: 0x40000000,
        0x1f000000: 0x40084010,
        0x10800000: 0x84010,
        0x11800000: 0x80000,
        0x12800000: 0x40080000,
        0x13800000: 0x4000,
        0x14800000: 0x40004000,
        0x15800000: 0x40084010,
        0x16800000: 0x10,
        0x17800000: 0x40000000,
        0x18800000: 0x40084000,
        0x19800000: 0x40000010,
        0x1a800000: 0x40004010,
        0x1b800000: 0x80010,
        0x1c800000: 0x0,
        0x1d800000: 0x4010,
        0x1e800000: 0x40080010,
        0x1f800000: 0x84000,
      },
      {
        0x0: 0x104,
        0x100000: 0x0,
        0x200000: 0x4000100,
        0x300000: 0x10104,
        0x400000: 0x10004,
        0x500000: 0x4000004,
        0x600000: 0x4010104,
        0x700000: 0x4010000,
        0x800000: 0x4000000,
        0x900000: 0x4010100,
        0xa00000: 0x10100,
        0xb00000: 0x4010004,
        0xc00000: 0x4000104,
        0xd00000: 0x10000,
        0xe00000: 0x4,
        0xf00000: 0x100,
        0x80000: 0x4010100,
        0x180000: 0x4010004,
        0x280000: 0x0,
        0x380000: 0x4000100,
        0x480000: 0x4000004,
        0x580000: 0x10000,
        0x680000: 0x10004,
        0x780000: 0x104,
        0x880000: 0x4,
        0x980000: 0x100,
        0xa80000: 0x4010000,
        0xb80000: 0x10104,
        0xc80000: 0x10100,
        0xd80000: 0x4000104,
        0xe80000: 0x4010104,
        0xf80000: 0x4000000,
        0x1000000: 0x4010100,
        0x1100000: 0x10004,
        0x1200000: 0x10000,
        0x1300000: 0x4000100,
        0x1400000: 0x100,
        0x1500000: 0x4010104,
        0x1600000: 0x4000004,
        0x1700000: 0x0,
        0x1800000: 0x4000104,
        0x1900000: 0x4000000,
        0x1a00000: 0x4,
        0x1b00000: 0x10100,
        0x1c00000: 0x4010000,
        0x1d00000: 0x104,
        0x1e00000: 0x10104,
        0x1f00000: 0x4010004,
        0x1080000: 0x4000000,
        0x1180000: 0x104,
        0x1280000: 0x4010100,
        0x1380000: 0x0,
        0x1480000: 0x10004,
        0x1580000: 0x4000100,
        0x1680000: 0x100,
        0x1780000: 0x4010004,
        0x1880000: 0x10000,
        0x1980000: 0x4010104,
        0x1a80000: 0x10104,
        0x1b80000: 0x4000004,
        0x1c80000: 0x4000104,
        0x1d80000: 0x4010000,
        0x1e80000: 0x4,
        0x1f80000: 0x10100,
      },
      {
        0x0: 0x80401000,
        0x10000: 0x80001040,
        0x20000: 0x401040,
        0x30000: 0x80400000,
        0x40000: 0x0,
        0x50000: 0x401000,
        0x60000: 0x80000040,
        0x70000: 0x400040,
        0x80000: 0x80000000,
        0x90000: 0x400000,
        0xa0000: 0x40,
        0xb0000: 0x80001000,
        0xc0000: 0x80400040,
        0xd0000: 0x1040,
        0xe0000: 0x1000,
        0xf0000: 0x80401040,
        0x8000: 0x80001040,
        0x18000: 0x40,
        0x28000: 0x80400040,
        0x38000: 0x80001000,
        0x48000: 0x401000,
        0x58000: 0x80401040,
        0x68000: 0x0,
        0x78000: 0x80400000,
        0x88000: 0x1000,
        0x98000: 0x80401000,
        0xa8000: 0x400000,
        0xb8000: 0x1040,
        0xc8000: 0x80000000,
        0xd8000: 0x400040,
        0xe8000: 0x401040,
        0xf8000: 0x80000040,
        0x100000: 0x400040,
        0x110000: 0x401000,
        0x120000: 0x80000040,
        0x130000: 0x0,
        0x140000: 0x1040,
        0x150000: 0x80400040,
        0x160000: 0x80401000,
        0x170000: 0x80001040,
        0x180000: 0x80401040,
        0x190000: 0x80000000,
        0x1a0000: 0x80400000,
        0x1b0000: 0x401040,
        0x1c0000: 0x80001000,
        0x1d0000: 0x400000,
        0x1e0000: 0x40,
        0x1f0000: 0x1000,
        0x108000: 0x80400000,
        0x118000: 0x80401040,
        0x128000: 0x0,
        0x138000: 0x401000,
        0x148000: 0x400040,
        0x158000: 0x80000000,
        0x168000: 0x80001040,
        0x178000: 0x40,
        0x188000: 0x80000040,
        0x198000: 0x1000,
        0x1a8000: 0x80001000,
        0x1b8000: 0x80400040,
        0x1c8000: 0x1040,
        0x1d8000: 0x80401000,
        0x1e8000: 0x400000,
        0x1f8000: 0x401040,
      },
      {
        0x0: 0x80,
        0x1000: 0x1040000,
        0x2000: 0x40000,
        0x3000: 0x20000000,
        0x4000: 0x20040080,
        0x5000: 0x1000080,
        0x6000: 0x21000080,
        0x7000: 0x40080,
        0x8000: 0x1000000,
        0x9000: 0x20040000,
        0xa000: 0x20000080,
        0xb000: 0x21040080,
        0xc000: 0x21040000,
        0xd000: 0x0,
        0xe000: 0x1040080,
        0xf000: 0x21000000,
        0x800: 0x1040080,
        0x1800: 0x21000080,
        0x2800: 0x80,
        0x3800: 0x1040000,
        0x4800: 0x40000,
        0x5800: 0x20040080,
        0x6800: 0x21040000,
        0x7800: 0x20000000,
        0x8800: 0x20040000,
        0x9800: 0x0,
        0xa800: 0x21040080,
        0xb800: 0x1000080,
        0xc800: 0x20000080,
        0xd800: 0x21000000,
        0xe800: 0x1000000,
        0xf800: 0x40080,
        0x10000: 0x40000,
        0x11000: 0x80,
        0x12000: 0x20000000,
        0x13000: 0x21000080,
        0x14000: 0x1000080,
        0x15000: 0x21040000,
        0x16000: 0x20040080,
        0x17000: 0x1000000,
        0x18000: 0x21040080,
        0x19000: 0x21000000,
        0x1a000: 0x1040000,
        0x1b000: 0x20040000,
        0x1c000: 0x40080,
        0x1d000: 0x20000080,
        0x1e000: 0x0,
        0x1f000: 0x1040080,
        0x10800: 0x21000080,
        0x11800: 0x1000000,
        0x12800: 0x1040000,
        0x13800: 0x20040080,
        0x14800: 0x20000000,
        0x15800: 0x1040080,
        0x16800: 0x80,
        0x17800: 0x21040000,
        0x18800: 0x40080,
        0x19800: 0x21040080,
        0x1a800: 0x0,
        0x1b800: 0x21000000,
        0x1c800: 0x1000080,
        0x1d800: 0x40000,
        0x1e800: 0x20040000,
        0x1f800: 0x20000080,
      },
      {
        0x0: 0x10000008,
        0x100: 0x2000,
        0x200: 0x10200000,
        0x300: 0x10202008,
        0x400: 0x10002000,
        0x500: 0x200000,
        0x600: 0x200008,
        0x700: 0x10000000,
        0x800: 0x0,
        0x900: 0x10002008,
        0xa00: 0x202000,
        0xb00: 0x8,
        0xc00: 0x10200008,
        0xd00: 0x202008,
        0xe00: 0x2008,
        0xf00: 0x10202000,
        0x80: 0x10200000,
        0x180: 0x10202008,
        0x280: 0x8,
        0x380: 0x200000,
        0x480: 0x202008,
        0x580: 0x10000008,
        0x680: 0x10002000,
        0x780: 0x2008,
        0x880: 0x200008,
        0x980: 0x2000,
        0xa80: 0x10002008,
        0xb80: 0x10200008,
        0xc80: 0x0,
        0xd80: 0x10202000,
        0xe80: 0x202000,
        0xf80: 0x10000000,
        0x1000: 0x10002000,
        0x1100: 0x10200008,
        0x1200: 0x10202008,
        0x1300: 0x2008,
        0x1400: 0x200000,
        0x1500: 0x10000000,
        0x1600: 0x10000008,
        0x1700: 0x202000,
        0x1800: 0x202008,
        0x1900: 0x0,
        0x1a00: 0x8,
        0x1b00: 0x10200000,
        0x1c00: 0x2000,
        0x1d00: 0x10002008,
        0x1e00: 0x10202000,
        0x1f00: 0x200008,
        0x1080: 0x8,
        0x1180: 0x202000,
        0x1280: 0x200000,
        0x1380: 0x10000008,
        0x1480: 0x10002000,
        0x1580: 0x2008,
        0x1680: 0x10202008,
        0x1780: 0x10200000,
        0x1880: 0x10202000,
        0x1980: 0x10200008,
        0x1a80: 0x2000,
        0x1b80: 0x202008,
        0x1c80: 0x200008,
        0x1d80: 0x0,
        0x1e80: 0x10000000,
        0x1f80: 0x10002008,
      },
      {
        0x0: 0x100000,
        0x10: 0x2000401,
        0x20: 0x400,
        0x30: 0x100401,
        0x40: 0x2100401,
        0x50: 0x0,
        0x60: 0x1,
        0x70: 0x2100001,
        0x80: 0x2000400,
        0x90: 0x100001,
        0xa0: 0x2000001,
        0xb0: 0x2100400,
        0xc0: 0x2100000,
        0xd0: 0x401,
        0xe0: 0x100400,
        0xf0: 0x2000000,
        0x8: 0x2100001,
        0x18: 0x0,
        0x28: 0x2000401,
        0x38: 0x2100400,
        0x48: 0x100000,
        0x58: 0x2000001,
        0x68: 0x2000000,
        0x78: 0x401,
        0x88: 0x100401,
        0x98: 0x2000400,
        0xa8: 0x2100000,
        0xb8: 0x100001,
        0xc8: 0x400,
        0xd8: 0x2100401,
        0xe8: 0x1,
        0xf8: 0x100400,
        0x100: 0x2000000,
        0x110: 0x100000,
        0x120: 0x2000401,
        0x130: 0x2100001,
        0x140: 0x100001,
        0x150: 0x2000400,
        0x160: 0x2100400,
        0x170: 0x100401,
        0x180: 0x401,
        0x190: 0x2100401,
        0x1a0: 0x100400,
        0x1b0: 0x1,
        0x1c0: 0x0,
        0x1d0: 0x2100000,
        0x1e0: 0x2000001,
        0x1f0: 0x400,
        0x108: 0x100400,
        0x118: 0x2000401,
        0x128: 0x2100001,
        0x138: 0x1,
        0x148: 0x2000000,
        0x158: 0x100000,
        0x168: 0x401,
        0x178: 0x2100400,
        0x188: 0x2000001,
        0x198: 0x2100000,
        0x1a8: 0x0,
        0x1b8: 0x2100401,
        0x1c8: 0x100401,
        0x1d8: 0x400,
        0x1e8: 0x2000400,
        0x1f8: 0x100001,
      },
      {
        0x0: 0x8000820,
        0x1: 0x20000,
        0x2: 0x8000000,
        0x3: 0x20,
        0x4: 0x20020,
        0x5: 0x8020820,
        0x6: 0x8020800,
        0x7: 0x800,
        0x8: 0x8020000,
        0x9: 0x8000800,
        0xa: 0x20800,
        0xb: 0x8020020,
        0xc: 0x820,
        0xd: 0x0,
        0xe: 0x8000020,
        0xf: 0x20820,
        0x80000000: 0x800,
        0x80000001: 0x8020820,
        0x80000002: 0x8000820,
        0x80000003: 0x8000000,
        0x80000004: 0x8020000,
        0x80000005: 0x20800,
        0x80000006: 0x20820,
        0x80000007: 0x20,
        0x80000008: 0x8000020,
        0x80000009: 0x820,
        0x8000000a: 0x20020,
        0x8000000b: 0x8020800,
        0x8000000c: 0x0,
        0x8000000d: 0x8020020,
        0x8000000e: 0x8000800,
        0x8000000f: 0x20000,
        0x10: 0x20820,
        0x11: 0x8020800,
        0x12: 0x20,
        0x13: 0x800,
        0x14: 0x8000800,
        0x15: 0x8000020,
        0x16: 0x8020020,
        0x17: 0x20000,
        0x18: 0x0,
        0x19: 0x20020,
        0x1a: 0x8020000,
        0x1b: 0x8000820,
        0x1c: 0x8020820,
        0x1d: 0x20800,
        0x1e: 0x820,
        0x1f: 0x8000000,
        0x80000010: 0x20000,
        0x80000011: 0x800,
        0x80000012: 0x8020020,
        0x80000013: 0x20820,
        0x80000014: 0x20,
        0x80000015: 0x8020000,
        0x80000016: 0x8000000,
        0x80000017: 0x8000820,
        0x80000018: 0x8020820,
        0x80000019: 0x8000020,
        0x8000001a: 0x8000800,
        0x8000001b: 0x0,
        0x8000001c: 0x20800,
        0x8000001d: 0x820,
        0x8000001e: 0x20020,
        0x8000001f: 0x8020800,
      },
    ];

    // Masks that select the SBOX input
    var SBOX_MASK = [
      0xf8000001, 0x1f800000, 0x01f80000, 0x001f8000, 0x0001f800, 0x00001f80,
      0x000001f8, 0x8000001f,
    ];

    /**
     * DES block cipher algorithm.
     */
    var DES = (C_algo.DES = BlockCipher.extend({
      _doReset: function () {
        // Shortcuts
        var key = this._key;
        var keyWords = key.words;

        // Select 56 bits according to PC1
        var keyBits = [];
        for (var i = 0; i < 56; i++) {
          var keyBitPos = PC1[i] - 1;
          keyBits[i] =
            (keyWords[keyBitPos >>> 5] >>> (31 - (keyBitPos % 32))) & 1;
        }

        // Assemble 16 subkeys
        var subKeys = (this._subKeys = []);
        for (var nSubKey = 0; nSubKey < 16; nSubKey++) {
          // Create subkey
          var subKey = (subKeys[nSubKey] = []);

          // Shortcut
          var bitShift = BIT_SHIFTS[nSubKey];

          // Select 48 bits according to PC2
          for (var i = 0; i < 24; i++) {
            // Select from the left 28 key bits
            subKey[(i / 6) | 0] |=
              keyBits[(PC2[i] - 1 + bitShift) % 28] << (31 - (i % 6));

            // Select from the right 28 key bits
            subKey[4 + ((i / 6) | 0)] |=
              keyBits[28 + ((PC2[i + 24] - 1 + bitShift) % 28)] <<
              (31 - (i % 6));
          }

          // Since each subkey is applied to an expanded 32-bit input,
          // the subkey can be broken into 8 values scaled to 32-bits,
          // which allows the key to be used without expansion
          subKey[0] = (subKey[0] << 1) | (subKey[0] >>> 31);
          for (var i = 1; i < 7; i++) {
            subKey[i] = subKey[i] >>> ((i - 1) * 4 + 3);
          }
          subKey[7] = (subKey[7] << 5) | (subKey[7] >>> 27);
        }

        // Compute inverse subkeys
        var invSubKeys = (this._invSubKeys = []);
        for (var i = 0; i < 16; i++) {
          invSubKeys[i] = subKeys[15 - i];
        }
      },

      encryptBlock: function (M, offset) {
        this._doCryptBlock(M, offset, this._subKeys);
      },

      decryptBlock: function (M, offset) {
        this._doCryptBlock(M, offset, this._invSubKeys);
      },

      _doCryptBlock: function (M, offset, subKeys) {
        // Get input
        this._lBlock = M[offset];
        this._rBlock = M[offset + 1];

        // Initial permutation
        exchangeLR.call(this, 4, 0x0f0f0f0f);
        exchangeLR.call(this, 16, 0x0000ffff);
        exchangeRL.call(this, 2, 0x33333333);
        exchangeRL.call(this, 8, 0x00ff00ff);
        exchangeLR.call(this, 1, 0x55555555);

        // Rounds
        for (var round = 0; round < 16; round++) {
          // Shortcuts
          var subKey = subKeys[round];
          var lBlock = this._lBlock;
          var rBlock = this._rBlock;

          // Feistel function
          var f = 0;
          for (var i = 0; i < 8; i++) {
            f |= SBOX_P[i][((rBlock ^ subKey[i]) & SBOX_MASK[i]) >>> 0];
          }
          this._lBlock = rBlock;
          this._rBlock = lBlock ^ f;
        }

        // Undo swap from last round
        var t = this._lBlock;
        this._lBlock = this._rBlock;
        this._rBlock = t;

        // Final permutation
        exchangeLR.call(this, 1, 0x55555555);
        exchangeRL.call(this, 8, 0x00ff00ff);
        exchangeRL.call(this, 2, 0x33333333);
        exchangeLR.call(this, 16, 0x0000ffff);
        exchangeLR.call(this, 4, 0x0f0f0f0f);

        // Set output
        M[offset] = this._lBlock;
        M[offset + 1] = this._rBlock;
      },

      keySize: 64 / 32,

      ivSize: 64 / 32,

      blockSize: 64 / 32,
    }));

    // Swap bits across the left and right words
    function exchangeLR(offset, mask) {
      var t = ((this._lBlock >>> offset) ^ this._rBlock) & mask;
      this._rBlock ^= t;
      this._lBlock ^= t << offset;
    }

    function exchangeRL(offset, mask) {
      var t = ((this._rBlock >>> offset) ^ this._lBlock) & mask;
      this._lBlock ^= t;
      this._rBlock ^= t << offset;
    }

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.DES.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.DES.decrypt(ciphertext, key, cfg);
     */
    C.DES = BlockCipher._createHelper(DES);

    /**
     * Triple-DES block cipher algorithm.
     */
    var TripleDES = (C_algo.TripleDES = BlockCipher.extend({
      _doReset: function () {
        // Shortcuts
        var key = this._key;
        var keyWords = key.words;
        // Make sure the key length is valid (64, 128 or >= 192 bit)
        if (
          keyWords.length !== 2 &&
          keyWords.length !== 4 &&
          keyWords.length < 6
        ) {
          throw new Error(
            "Invalid key length - 3DES requires the key length to be 64, 128, 192 or >192."
          );
        }

        // Extend the key according to the keying options defined in 3DES standard
        var key1 = keyWords.slice(0, 2);
        var key2 =
          keyWords.length < 4 ? keyWords.slice(0, 2) : keyWords.slice(2, 4);
        var key3 =
          keyWords.length < 6 ? keyWords.slice(0, 2) : keyWords.slice(4, 6);

        // Create DES instances
        this._des1 = DES.createEncryptor(WordArray.create(key1));
        this._des2 = DES.createEncryptor(WordArray.create(key2));
        this._des3 = DES.createEncryptor(WordArray.create(key3));
      },

      encryptBlock: function (M, offset) {
        this._des1.encryptBlock(M, offset);
        this._des2.decryptBlock(M, offset);
        this._des3.encryptBlock(M, offset);
      },

      decryptBlock: function (M, offset) {
        this._des3.decryptBlock(M, offset);
        this._des2.encryptBlock(M, offset);
        this._des1.decryptBlock(M, offset);
      },

      keySize: 192 / 32,

      ivSize: 64 / 32,

      blockSize: 64 / 32,
    }));

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.TripleDES.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.TripleDES.decrypt(ciphertext, key, cfg);
     */
    C.TripleDES = BlockCipher._createHelper(TripleDES);
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var StreamCipher = C_lib.StreamCipher;
    var C_algo = C.algo;

    /**
     * RC4 stream cipher algorithm.
     */
    var RC4 = (C_algo.RC4 = StreamCipher.extend({
      _doReset: function () {
        // Shortcuts
        var key = this._key;
        var keyWords = key.words;
        var keySigBytes = key.sigBytes;

        // Init sbox
        var S = (this._S = []);
        for (var i = 0; i < 256; i++) {
          S[i] = i;
        }

        // Key setup
        for (var i = 0, j = 0; i < 256; i++) {
          var keyByteIndex = i % keySigBytes;
          var keyByte =
            (keyWords[keyByteIndex >>> 2] >>> (24 - (keyByteIndex % 4) * 8)) &
            0xff;

          j = (j + S[i] + keyByte) % 256;

          // Swap
          var t = S[i];
          S[i] = S[j];
          S[j] = t;
        }

        // Counters
        this._i = this._j = 0;
      },

      _doProcessBlock: function (M, offset) {
        M[offset] ^= generateKeystreamWord.call(this);
      },

      keySize: 256 / 32,

      ivSize: 0,
    }));

    function generateKeystreamWord() {
      // Shortcuts
      var S = this._S;
      var i = this._i;
      var j = this._j;

      // Generate keystream word
      var keystreamWord = 0;
      for (var n = 0; n < 4; n++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;

        // Swap
        var t = S[i];
        S[i] = S[j];
        S[j] = t;

        keystreamWord |= S[(S[i] + S[j]) % 256] << (24 - n * 8);
      }

      // Update counters
      this._i = i;
      this._j = j;

      return keystreamWord;
    }

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.RC4.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.RC4.decrypt(ciphertext, key, cfg);
     */
    C.RC4 = StreamCipher._createHelper(RC4);

    /**
     * Modified RC4 stream cipher algorithm.
     */
    var RC4Drop = (C_algo.RC4Drop = RC4.extend({
      /**
       * Configuration options.
       *
       * @property {number} drop The number of keystream words to drop. Default 192
       */
      cfg: RC4.cfg.extend({
        drop: 192,
      }),

      _doReset: function () {
        RC4._doReset.call(this);

        // Drop
        for (var i = this.cfg.drop; i > 0; i--) {
          generateKeystreamWord.call(this);
        }
      },
    }));

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.RC4Drop.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.RC4Drop.decrypt(ciphertext, key, cfg);
     */
    C.RC4Drop = StreamCipher._createHelper(RC4Drop);
  })();

  /** @preserve
   * Counter block mode compatible with  Dr Brian Gladman fileenc.c
   * derived from CryptoJS.mode.CTR
   * Jan Hruby jhruby.web@gmail.com
   */
  CryptoJS.mode.CTRGladman = (function () {
    var CTRGladman = CryptoJS.lib.BlockCipherMode.extend();

    function incWord(word) {
      if (((word >> 24) & 0xff) === 0xff) {
        //overflow
        var b1 = (word >> 16) & 0xff;
        var b2 = (word >> 8) & 0xff;
        var b3 = word & 0xff;

        if (b1 === 0xff) {
          // overflow b1
          b1 = 0;
          if (b2 === 0xff) {
            b2 = 0;
            if (b3 === 0xff) {
              b3 = 0;
            } else {
              ++b3;
            }
          } else {
            ++b2;
          }
        } else {
          ++b1;
        }

        word = 0;
        word += b1 << 16;
        word += b2 << 8;
        word += b3;
      } else {
        word += 0x01 << 24;
      }
      return word;
    }

    function incCounter(counter) {
      if ((counter[0] = incWord(counter[0])) === 0) {
        // encr_data in fileenc.c from  Dr Brian Gladman's counts only with DWORD j < 8
        counter[1] = incWord(counter[1]);
      }
      return counter;
    }

    var Encryptor = (CTRGladman.Encryptor = CTRGladman.extend({
      processBlock: function (words, offset) {
        // Shortcuts
        var cipher = this._cipher;
        var blockSize = cipher.blockSize;
        var iv = this._iv;
        var counter = this._counter;

        // Generate keystream
        if (iv) {
          counter = this._counter = iv.slice(0);

          // Remove IV for subsequent blocks
          this._iv = undefined;
        }

        incCounter(counter);

        var keystream = counter.slice(0);
        cipher.encryptBlock(keystream, 0);

        // Encrypt
        for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= keystream[i];
        }
      },
    }));

    CTRGladman.Decryptor = Encryptor;

    return CTRGladman;
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var StreamCipher = C_lib.StreamCipher;
    var C_algo = C.algo;

    // Reusable objects
    var S = [];
    var C_ = [];
    var G = [];

    /**
     * Rabbit stream cipher algorithm
     */
    var Rabbit = (C_algo.Rabbit = StreamCipher.extend({
      _doReset: function () {
        // Shortcuts
        var K = this._key.words;
        var iv = this.cfg.iv;

        // Swap endian
        for (var i = 0; i < 4; i++) {
          K[i] =
            (((K[i] << 8) | (K[i] >>> 24)) & 0x00ff00ff) |
            (((K[i] << 24) | (K[i] >>> 8)) & 0xff00ff00);
        }

        // Generate initial state values
        var X = (this._X = [
          K[0],
          (K[3] << 16) | (K[2] >>> 16),
          K[1],
          (K[0] << 16) | (K[3] >>> 16),
          K[2],
          (K[1] << 16) | (K[0] >>> 16),
          K[3],
          (K[2] << 16) | (K[1] >>> 16),
        ]);

        // Generate initial counter values
        var C = (this._C = [
          (K[2] << 16) | (K[2] >>> 16),
          (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
          (K[3] << 16) | (K[3] >>> 16),
          (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
          (K[0] << 16) | (K[0] >>> 16),
          (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
          (K[1] << 16) | (K[1] >>> 16),
          (K[3] & 0xffff0000) | (K[0] & 0x0000ffff),
        ]);

        // Carry bit
        this._b = 0;

        // Iterate the system four times
        for (var i = 0; i < 4; i++) {
          nextState.call(this);
        }

        // Modify the counters
        for (var i = 0; i < 8; i++) {
          C[i] ^= X[(i + 4) & 7];
        }

        // IV setup
        if (iv) {
          // Shortcuts
          var IV = iv.words;
          var IV_0 = IV[0];
          var IV_1 = IV[1];

          // Generate four subvectors
          var i0 =
            (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) |
            (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
          var i2 =
            (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) |
            (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
          var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
          var i3 = (i2 << 16) | (i0 & 0x0000ffff);

          // Modify counter values
          C[0] ^= i0;
          C[1] ^= i1;
          C[2] ^= i2;
          C[3] ^= i3;
          C[4] ^= i0;
          C[5] ^= i1;
          C[6] ^= i2;
          C[7] ^= i3;

          // Iterate the system four times
          for (var i = 0; i < 4; i++) {
            nextState.call(this);
          }
        }
      },

      _doProcessBlock: function (M, offset) {
        // Shortcut
        var X = this._X;

        // Iterate the system
        nextState.call(this);

        // Generate four keystream words
        S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
        S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
        S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
        S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

        for (var i = 0; i < 4; i++) {
          // Swap endian
          S[i] =
            (((S[i] << 8) | (S[i] >>> 24)) & 0x00ff00ff) |
            (((S[i] << 24) | (S[i] >>> 8)) & 0xff00ff00);

          // Encrypt
          M[offset + i] ^= S[i];
        }
      },

      blockSize: 128 / 32,

      ivSize: 64 / 32,
    }));

    function nextState() {
      // Shortcuts
      var X = this._X;
      var C = this._C;

      // Save old counter values
      for (var i = 0; i < 8; i++) {
        C_[i] = C[i];
      }

      // Calculate new counter values
      C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
      C[1] = (C[1] + 0xd34d34d3 + (C[0] >>> 0 < C_[0] >>> 0 ? 1 : 0)) | 0;
      C[2] = (C[2] + 0x34d34d34 + (C[1] >>> 0 < C_[1] >>> 0 ? 1 : 0)) | 0;
      C[3] = (C[3] + 0x4d34d34d + (C[2] >>> 0 < C_[2] >>> 0 ? 1 : 0)) | 0;
      C[4] = (C[4] + 0xd34d34d3 + (C[3] >>> 0 < C_[3] >>> 0 ? 1 : 0)) | 0;
      C[5] = (C[5] + 0x34d34d34 + (C[4] >>> 0 < C_[4] >>> 0 ? 1 : 0)) | 0;
      C[6] = (C[6] + 0x4d34d34d + (C[5] >>> 0 < C_[5] >>> 0 ? 1 : 0)) | 0;
      C[7] = (C[7] + 0xd34d34d3 + (C[6] >>> 0 < C_[6] >>> 0 ? 1 : 0)) | 0;
      this._b = C[7] >>> 0 < C_[7] >>> 0 ? 1 : 0;

      // Calculate the g-values
      for (var i = 0; i < 8; i++) {
        var gx = X[i] + C[i];

        // Construct high and low argument for squaring
        var ga = gx & 0xffff;
        var gb = gx >>> 16;

        // Calculate high and low result of squaring
        var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
        var gl =
          (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

        // High XOR low
        G[i] = gh ^ gl;
      }

      // Calculate new state values
      X[0] =
        (G[0] +
          ((G[7] << 16) | (G[7] >>> 16)) +
          ((G[6] << 16) | (G[6] >>> 16))) |
        0;
      X[1] = (G[1] + ((G[0] << 8) | (G[0] >>> 24)) + G[7]) | 0;
      X[2] =
        (G[2] +
          ((G[1] << 16) | (G[1] >>> 16)) +
          ((G[0] << 16) | (G[0] >>> 16))) |
        0;
      X[3] = (G[3] + ((G[2] << 8) | (G[2] >>> 24)) + G[1]) | 0;
      X[4] =
        (G[4] +
          ((G[3] << 16) | (G[3] >>> 16)) +
          ((G[2] << 16) | (G[2] >>> 16))) |
        0;
      X[5] = (G[5] + ((G[4] << 8) | (G[4] >>> 24)) + G[3]) | 0;
      X[6] =
        (G[6] +
          ((G[5] << 16) | (G[5] >>> 16)) +
          ((G[4] << 16) | (G[4] >>> 16))) |
        0;
      X[7] = (G[7] + ((G[6] << 8) | (G[6] >>> 24)) + G[5]) | 0;
    }

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.Rabbit.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.Rabbit.decrypt(ciphertext, key, cfg);
     */
    C.Rabbit = StreamCipher._createHelper(Rabbit);
  })();

  /**
   * Counter block mode.
   */
  CryptoJS.mode.CTR = (function () {
    var CTR = CryptoJS.lib.BlockCipherMode.extend();

    var Encryptor = (CTR.Encryptor = CTR.extend({
      processBlock: function (words, offset) {
        // Shortcuts
        var cipher = this._cipher;
        var blockSize = cipher.blockSize;
        var iv = this._iv;
        var counter = this._counter;

        // Generate keystream
        if (iv) {
          counter = this._counter = iv.slice(0);

          // Remove IV for subsequent blocks
          this._iv = undefined;
        }
        var keystream = counter.slice(0);
        cipher.encryptBlock(keystream, 0);

        // Increment counter
        counter[blockSize - 1] = (counter[blockSize - 1] + 1) | 0;

        // Encrypt
        for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= keystream[i];
        }
      },
    }));

    CTR.Decryptor = Encryptor;

    return CTR;
  })();

  (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var StreamCipher = C_lib.StreamCipher;
    var C_algo = C.algo;

    // Reusable objects
    var S = [];
    var C_ = [];
    var G = [];

    /**
     * Rabbit stream cipher algorithm.
     *
     * This is a legacy version that neglected to convert the key to little-endian.
     * This error doesn't affect the cipher's security,
     * but it does affect its compatibility with other implementations.
     */
    var RabbitLegacy = (C_algo.RabbitLegacy = StreamCipher.extend({
      _doReset: function () {
        // Shortcuts
        var K = this._key.words;
        var iv = this.cfg.iv;

        // Generate initial state values
        var X = (this._X = [
          K[0],
          (K[3] << 16) | (K[2] >>> 16),
          K[1],
          (K[0] << 16) | (K[3] >>> 16),
          K[2],
          (K[1] << 16) | (K[0] >>> 16),
          K[3],
          (K[2] << 16) | (K[1] >>> 16),
        ]);

        // Generate initial counter values
        var C = (this._C = [
          (K[2] << 16) | (K[2] >>> 16),
          (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
          (K[3] << 16) | (K[3] >>> 16),
          (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
          (K[0] << 16) | (K[0] >>> 16),
          (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
          (K[1] << 16) | (K[1] >>> 16),
          (K[3] & 0xffff0000) | (K[0] & 0x0000ffff),
        ]);

        // Carry bit
        this._b = 0;

        // Iterate the system four times
        for (var i = 0; i < 4; i++) {
          nextState.call(this);
        }

        // Modify the counters
        for (var i = 0; i < 8; i++) {
          C[i] ^= X[(i + 4) & 7];
        }

        // IV setup
        if (iv) {
          // Shortcuts
          var IV = iv.words;
          var IV_0 = IV[0];
          var IV_1 = IV[1];

          // Generate four subvectors
          var i0 =
            (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) |
            (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
          var i2 =
            (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) |
            (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
          var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
          var i3 = (i2 << 16) | (i0 & 0x0000ffff);

          // Modify counter values
          C[0] ^= i0;
          C[1] ^= i1;
          C[2] ^= i2;
          C[3] ^= i3;
          C[4] ^= i0;
          C[5] ^= i1;
          C[6] ^= i2;
          C[7] ^= i3;

          // Iterate the system four times
          for (var i = 0; i < 4; i++) {
            nextState.call(this);
          }
        }
      },

      _doProcessBlock: function (M, offset) {
        // Shortcut
        var X = this._X;

        // Iterate the system
        nextState.call(this);

        // Generate four keystream words
        S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
        S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
        S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
        S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

        for (var i = 0; i < 4; i++) {
          // Swap endian
          S[i] =
            (((S[i] << 8) | (S[i] >>> 24)) & 0x00ff00ff) |
            (((S[i] << 24) | (S[i] >>> 8)) & 0xff00ff00);

          // Encrypt
          M[offset + i] ^= S[i];
        }
      },

      blockSize: 128 / 32,

      ivSize: 64 / 32,
    }));

    function nextState() {
      // Shortcuts
      var X = this._X;
      var C = this._C;

      // Save old counter values
      for (var i = 0; i < 8; i++) {
        C_[i] = C[i];
      }

      // Calculate new counter values
      C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
      C[1] = (C[1] + 0xd34d34d3 + (C[0] >>> 0 < C_[0] >>> 0 ? 1 : 0)) | 0;
      C[2] = (C[2] + 0x34d34d34 + (C[1] >>> 0 < C_[1] >>> 0 ? 1 : 0)) | 0;
      C[3] = (C[3] + 0x4d34d34d + (C[2] >>> 0 < C_[2] >>> 0 ? 1 : 0)) | 0;
      C[4] = (C[4] + 0xd34d34d3 + (C[3] >>> 0 < C_[3] >>> 0 ? 1 : 0)) | 0;
      C[5] = (C[5] + 0x34d34d34 + (C[4] >>> 0 < C_[4] >>> 0 ? 1 : 0)) | 0;
      C[6] = (C[6] + 0x4d34d34d + (C[5] >>> 0 < C_[5] >>> 0 ? 1 : 0)) | 0;
      C[7] = (C[7] + 0xd34d34d3 + (C[6] >>> 0 < C_[6] >>> 0 ? 1 : 0)) | 0;
      this._b = C[7] >>> 0 < C_[7] >>> 0 ? 1 : 0;

      // Calculate the g-values
      for (var i = 0; i < 8; i++) {
        var gx = X[i] + C[i];

        // Construct high and low argument for squaring
        var ga = gx & 0xffff;
        var gb = gx >>> 16;

        // Calculate high and low result of squaring
        var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
        var gl =
          (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

        // High XOR low
        G[i] = gh ^ gl;
      }

      // Calculate new state values
      X[0] =
        (G[0] +
          ((G[7] << 16) | (G[7] >>> 16)) +
          ((G[6] << 16) | (G[6] >>> 16))) |
        0;
      X[1] = (G[1] + ((G[0] << 8) | (G[0] >>> 24)) + G[7]) | 0;
      X[2] =
        (G[2] +
          ((G[1] << 16) | (G[1] >>> 16)) +
          ((G[0] << 16) | (G[0] >>> 16))) |
        0;
      X[3] = (G[3] + ((G[2] << 8) | (G[2] >>> 24)) + G[1]) | 0;
      X[4] =
        (G[4] +
          ((G[3] << 16) | (G[3] >>> 16)) +
          ((G[2] << 16) | (G[2] >>> 16))) |
        0;
      X[5] = (G[5] + ((G[4] << 8) | (G[4] >>> 24)) + G[3]) | 0;
      X[6] =
        (G[6] +
          ((G[5] << 16) | (G[5] >>> 16)) +
          ((G[4] << 16) | (G[4] >>> 16))) |
        0;
      X[7] = (G[7] + ((G[6] << 8) | (G[6] >>> 24)) + G[5]) | 0;
    }

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.RabbitLegacy.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.RabbitLegacy.decrypt(ciphertext, key, cfg);
     */
    C.RabbitLegacy = StreamCipher._createHelper(RabbitLegacy);
  })();

  /**
   * Zero padding strategy.
   */
  CryptoJS.pad.ZeroPadding = {
    pad: function (data, blockSize) {
      // Shortcut
      var blockSizeBytes = blockSize * 4;

      // Pad
      data.clamp();
      data.sigBytes +=
        blockSizeBytes - (data.sigBytes % blockSizeBytes || blockSizeBytes);
    },

    unpad: function (data) {
      // Shortcut
      var dataWords = data.words;

      // Unpad
      var i = data.sigBytes - 1;
      for (var i = data.sigBytes - 1; i >= 0; i--) {
        if ((dataWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff) {
          data.sigBytes = i + 1;
          break;
        }
      }
    },
  };

  return CryptoJS;
});

/**
 * Generate password from allowed word
 */
const digits = "0123456789";
const alphabets = "abcdefghijklmnopqrstuvwxyz";
const upperCase = alphabets.toUpperCase();
const specialChars = "#!&@";

function rand(min, max) {
  const random = Math.random();
  return Math.floor(random * (max - min) + min);
}

/**
 * Generate OTP of the length
 * @param  {number} length length of password.
 * @param  {object} options
 * @param  {boolean} options.digits Default: `true` true value includes digits in OTP
 * @param  {boolean} options.alphabets Default: `true` true value includes alphabets in OTP
 * @param  {boolean} options.upperCase Default: `true` true value includes upperCase in OTP
 * @param  {boolean} options.specialChars Default: `true` true value includes specialChars in OTP
 */
const otpGenerator = function (length, options) {
  length = length || 10;
  const generateOptions = options || {};

  generateOptions.digits = Object.prototype.hasOwnProperty.call(
    generateOptions,
    "digits"
  )
    ? options.digits
    : true;
  generateOptions.alphabets = Object.prototype.hasOwnProperty.call(
    generateOptions,
    "alphabets"
  )
    ? options.alphabets
    : true;
  generateOptions.upperCase = Object.prototype.hasOwnProperty.call(
    generateOptions,
    "upperCase"
  )
    ? options.upperCase
    : true;
  generateOptions.specialChars = Object.prototype.hasOwnProperty.call(
    generateOptions,
    "specialChars"
  )
    ? options.specialChars
    : true;

  const allowsChars =
    ((generateOptions.digits || "") && digits) +
    ((generateOptions.alphabets || "") && alphabets) +
    ((generateOptions.upperCase || "") && upperCase) +
    ((generateOptions.specialChars || "") && specialChars);
  let password = "";
  while (password.length < length) {
    const charIndex = rand(0, allowsChars.length - 1);
    password += allowsChars[charIndex];
  }
  return password;
};

/*!
 LZ-UTF8 v0.5.8

 Copyright (c) 2021, Rotem Dan
 Released under the MIT license.

 Build date: 2021-02-24 

 Please report any issue at https://github.com/rotemdan/lzutf8.js/issues
*/
var IE10SubarrayBugPatcher, LZUTF8;
!(function (n) {
  (n.runningInNodeJS = function () {
    return (
      "object" == typeof process &&
      "object" == typeof process.versions &&
      "string" == typeof process.versions.node
    );
  }),
    (n.runningInMainNodeJSModule = function () {
      return n.runningInNodeJS() && require.main === module;
    }),
    (n.commonJSAvailable = function () {
      return "object" == typeof module && "object" == typeof module.exports;
    }),
    (n.runningInWebWorker = function () {
      return (
        "undefined" == typeof window &&
        "object" == typeof self &&
        "function" == typeof self.addEventListener &&
        "function" == typeof self.close
      );
    }),
    (n.runningInNodeChildProcess = function () {
      return n.runningInNodeJS() && "function" == typeof process.send;
    }),
    (n.runningInNullOrigin = function () {
      return (
        "object" == typeof window &&
        "object" == typeof window.location &&
        "object" == typeof document &&
        "http:" !== document.location.protocol &&
        "https:" !== document.location.protocol
      );
    }),
    (n.webWorkersAvailable = function () {
      return (
        "function" == typeof Worker &&
        !n.runningInNullOrigin() &&
        !n.runningInNodeJS() &&
        !(
          navigator &&
          navigator.userAgent &&
          0 <= navigator.userAgent.indexOf("Android 4.3")
        )
      );
    }),
    (n.log = function (e, t) {
      void 0 === t && (t = !1),
        "object" == typeof console &&
          (console.log(e),
          t &&
            "object" == typeof document &&
            (document.body.innerHTML += e + "<br/>"));
    }),
    (n.createErrorMessage = function (e, t) {
      if ((void 0 === t && (t = "Unhandled exception"), null == e)) return t;
      if (((t += ": "), "object" != typeof e.content))
        return "string" == typeof e.content ? t + e.content : t + e;
      if (n.runningInNodeJS()) return t + e.content.stack;
      var r = JSON.stringify(e.content);
      return "{}" !== r ? t + r : t + e.content;
    }),
    (n.printExceptionAndStackTraceToConsole = function (e, t) {
      void 0 === t && (t = "Unhandled exception"),
        n.log(n.createErrorMessage(e, t));
    }),
    (n.getGlobalObject = function () {
      return "object" == typeof global
        ? global
        : "object" == typeof window
        ? window
        : "object" == typeof self
        ? self
        : {};
    }),
    (n.toString = Object.prototype.toString),
    n.commonJSAvailable() && (module.exports = n);
})((LZUTF8 = LZUTF8 || {})),
  (function () {
    if (
      "function" == typeof Uint8Array &&
      0 !== new Uint8Array(1).subarray(1).byteLength
    ) {
      function e(e, t) {
        var r = function (e, t, r) {
          return e < t ? t : r < e ? r : e;
        };
        (e |= 0),
          (t |= 0),
          arguments.length < 1 && (e = 0),
          arguments.length < 2 && (t = this.length),
          e < 0 && (e = this.length + e),
          t < 0 && (t = this.length + t),
          (e = r(e, 0, this.length));
        r = (t = r(t, 0, this.length)) - e;
        return (
          r < 0 && (r = 0),
          new this.constructor(
            this.buffer,
            this.byteOffset + e * this.BYTES_PER_ELEMENT,
            r
          )
        );
      }
      var t = [
          "Int8Array",
          "Uint8Array",
          "Uint8ClampedArray",
          "Int16Array",
          "Uint16Array",
          "Int32Array",
          "Uint32Array",
          "Float32Array",
          "Float64Array",
        ],
        r = void 0;
      if (
        ("object" == typeof window
          ? (r = window)
          : "object" == typeof self && (r = self),
        void 0 !== r)
      )
        for (var n = 0; n < t.length; n++)
          r[t[n]] && (r[t[n]].prototype.subarray = e);
    }
  })((IE10SubarrayBugPatcher = IE10SubarrayBugPatcher || {})),
  (function (f) {
    var e =
      ((t.compressAsync = function (e, n, o) {
        var i = new f.Timer(),
          u = new f.Compressor();
        if (!o)
          throw new TypeError("compressAsync: No callback argument given");
        if ("string" == typeof e) e = f.encodeUTF8(e);
        else if (null == e || !(e instanceof Uint8Array))
          return void o(
            void 0,
            new TypeError(
              "compressAsync: Invalid input argument, only 'string' and 'Uint8Array' are supported"
            )
          );
        var s = f.ArrayTools.splitByteArray(e, n.blockSize),
          a = [],
          c = function (e) {
            if (e < s.length) {
              var t = void 0;
              try {
                t = u.compressBlock(s[e]);
              } catch (e) {
                return void o(void 0, e);
              }
              a.push(t),
                i.getElapsedTime() <= 20
                  ? c(e + 1)
                  : (f.enqueueImmediate(function () {
                      return c(e + 1);
                    }),
                    i.restart());
            } else {
              var r = f.ArrayTools.concatUint8Arrays(a);
              f.enqueueImmediate(function () {
                var e;
                try {
                  e = f.CompressionCommon.encodeCompressedBytes(
                    r,
                    n.outputEncoding
                  );
                } catch (e) {
                  return void o(void 0, e);
                }
                f.enqueueImmediate(function () {
                  return o(e);
                });
              });
            }
          };
        f.enqueueImmediate(function () {
          return c(0);
        });
      }),
      (t.createCompressionStream = function () {
        var o = new f.Compressor(),
          i = new (require("readable-stream").Transform)({
            decodeStrings: !0,
            highWaterMark: 65536,
          });
        return (
          (i._transform = function (e, t, r) {
            var n;
            try {
              n = f.BufferTools.uint8ArrayToBuffer(
                o.compressBlock(f.BufferTools.bufferToUint8Array(e))
              );
            } catch (e) {
              return void i.emit("error", e);
            }
            i.push(n), r();
          }),
          i
        );
      }),
      t);
    function t() {}
    f.AsyncCompressor = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (f) {
    var e =
      ((t.decompressAsync = function (e, n, o) {
        if (!o)
          throw new TypeError("decompressAsync: No callback argument given");
        var i = new f.Timer();
        try {
          e = f.CompressionCommon.decodeCompressedBytes(e, n.inputEncoding);
        } catch (e) {
          return void o(void 0, e);
        }
        var u = new f.Decompressor(),
          s = f.ArrayTools.splitByteArray(e, n.blockSize),
          a = [],
          c = function (e) {
            if (e < s.length) {
              var t = void 0;
              try {
                t = u.decompressBlock(s[e]);
              } catch (e) {
                return void o(void 0, e);
              }
              a.push(t),
                i.getElapsedTime() <= 20
                  ? c(e + 1)
                  : (f.enqueueImmediate(function () {
                      return c(e + 1);
                    }),
                    i.restart());
            } else {
              var r = f.ArrayTools.concatUint8Arrays(a);
              f.enqueueImmediate(function () {
                var e;
                try {
                  e = f.CompressionCommon.encodeDecompressedBytes(
                    r,
                    n.outputEncoding
                  );
                } catch (e) {
                  return void o(void 0, e);
                }
                f.enqueueImmediate(function () {
                  return o(e);
                });
              });
            }
          };
        f.enqueueImmediate(function () {
          return c(0);
        });
      }),
      (t.createDecompressionStream = function () {
        var o = new f.Decompressor(),
          i = new (require("readable-stream").Transform)({
            decodeStrings: !0,
            highWaterMark: 65536,
          });
        return (
          (i._transform = function (e, t, r) {
            var n;
            try {
              n = f.BufferTools.uint8ArrayToBuffer(
                o.decompressBlock(f.BufferTools.bufferToUint8Array(e))
              );
            } catch (e) {
              return void i.emit("error", e);
            }
            i.push(n), r();
          }),
          i
        );
      }),
      t);
    function t() {}
    f.AsyncDecompressor = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (i) {
    var e, u;
    ((u = e = i.WebWorker || (i.WebWorker = {})).compressAsync = function (
      e,
      t,
      r
    ) {
      var n, o;
      "ByteArray" != t.inputEncoding || e instanceof Uint8Array
        ? ((n = {
            token: Math.random().toString(),
            type: "compress",
            data: e,
            inputEncoding: t.inputEncoding,
            outputEncoding: t.outputEncoding,
          }),
          (o = function (e) {
            e = e.data;
            e &&
              e.token == n.token &&
              (u.globalWorker.removeEventListener("message", o),
              "error" == e.type ? r(void 0, new Error(e.error)) : r(e.data));
          }),
          u.globalWorker.addEventListener("message", o),
          u.globalWorker.postMessage(n, []))
        : r(void 0, new TypeError("compressAsync: input is not a Uint8Array"));
    }),
      (u.decompressAsync = function (e, t, r) {
        var n = {
            token: Math.random().toString(),
            type: "decompress",
            data: e,
            inputEncoding: t.inputEncoding,
            outputEncoding: t.outputEncoding,
          },
          o = function (e) {
            e = e.data;
            e &&
              e.token == n.token &&
              (u.globalWorker.removeEventListener("message", o),
              "error" == e.type ? r(void 0, new Error(e.error)) : r(e.data));
          };
        u.globalWorker.addEventListener("message", o),
          u.globalWorker.postMessage(n, []);
      }),
      (u.installWebWorkerIfNeeded = function () {
        "object" == typeof self &&
          void 0 === self.document &&
          null != self.addEventListener &&
          (self.addEventListener("message", function (e) {
            var t = e.data;
            if ("compress" == t.type) {
              var r = void 0;
              try {
                r = i.compress(t.data, { outputEncoding: t.outputEncoding });
              } catch (e) {
                return void self.postMessage(
                  {
                    token: t.token,
                    type: "error",
                    error: i.createErrorMessage(e),
                  },
                  []
                );
              }
              (n = {
                token: t.token,
                type: "compressionResult",
                data: r,
                encoding: t.outputEncoding,
              }).data instanceof Uint8Array &&
              -1 === navigator.appVersion.indexOf("MSIE 10")
                ? self.postMessage(n, [n.data.buffer])
                : self.postMessage(n, []);
            } else if ("decompress" == t.type) {
              var n,
                o = void 0;
              try {
                o = i.decompress(t.data, {
                  inputEncoding: t.inputEncoding,
                  outputEncoding: t.outputEncoding,
                });
              } catch (e) {
                return void self.postMessage(
                  {
                    token: t.token,
                    type: "error",
                    error: i.createErrorMessage(e),
                  },
                  []
                );
              }
              (n = {
                token: t.token,
                type: "decompressionResult",
                data: o,
                encoding: t.outputEncoding,
              }).data instanceof Uint8Array &&
              -1 === navigator.appVersion.indexOf("MSIE 10")
                ? self.postMessage(n, [n.data.buffer])
                : self.postMessage(n, []);
            }
          }),
          self.addEventListener("error", function (e) {
            i.log(
              i.createErrorMessage(
                e.error,
                "Unexpected LZUTF8 WebWorker exception"
              )
            );
          }));
      }),
      (u.createGlobalWorkerIfNeeded = function () {
        return (
          !!u.globalWorker ||
          (!!i.webWorkersAvailable() &&
            (u.scriptURI ||
              "object" != typeof document ||
              (null != (e = document.getElementById("lzutf8")) &&
                (u.scriptURI = e.getAttribute("src") || void 0)),
            !!u.scriptURI && ((u.globalWorker = new Worker(u.scriptURI)), !0)))
        );
        var e;
      }),
      (u.terminate = function () {
        u.globalWorker &&
          (u.globalWorker.terminate(), (u.globalWorker = void 0));
      }),
      e.installWebWorkerIfNeeded();
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var t =
      ((r.prototype.get = function (e) {
        return this.container[this.startPosition + e];
      }),
      (r.prototype.getInReversedOrder = function (e) {
        return this.container[this.startPosition + this.length - 1 - e];
      }),
      (r.prototype.set = function (e, t) {
        this.container[this.startPosition + e] = t;
      }),
      r);
    function r(e, t, r) {
      (this.container = e), (this.startPosition = t), (this.length = r);
    }
    e.ArraySegment = t;
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    ((e = e.ArrayTools || (e.ArrayTools = {})).copyElements = function (
      e,
      t,
      r,
      n,
      o
    ) {
      for (; o--; ) r[n++] = e[t++];
    }),
      (e.zeroElements = function (e, t, r) {
        for (; r--; ) e[t++] = 0;
      }),
      (e.countNonzeroValuesInArray = function (e) {
        for (var t = 0, r = 0; r < e.length; r++) e[r] && t++;
        return t;
      }),
      (e.truncateStartingElements = function (e, t) {
        if (e.length <= t)
          throw new RangeError(
            "truncateStartingElements: Requested length should be smaller than array length"
          );
        for (var r = e.length - t, n = 0; n < t; n++) e[n] = e[r + n];
        e.length = t;
      }),
      (e.doubleByteArrayCapacity = function (e) {
        var t = new Uint8Array(2 * e.length);
        return t.set(e), t;
      }),
      (e.concatUint8Arrays = function (e) {
        for (var t = 0, r = 0, n = e; r < n.length; r++) t += (a = n[r]).length;
        for (
          var o = new Uint8Array(t), i = 0, u = 0, s = e;
          u < s.length;
          u++
        ) {
          var a = s[u];
          o.set(a, i), (i += a.length);
        }
        return o;
      }),
      (e.splitByteArray = function (e, t) {
        for (var r = [], n = 0; n < e.length; ) {
          var o = Math.min(t, e.length - n);
          r.push(e.subarray(n, n + o)), (n += o);
        }
        return r;
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var t;
    ((t = e.BufferTools || (e.BufferTools = {})).convertToUint8ArrayIfNeeded =
      function (e) {
        return "function" == typeof Buffer && Buffer.isBuffer(e)
          ? t.bufferToUint8Array(e)
          : e;
      }),
      (t.uint8ArrayToBuffer = function (e) {
        if (Buffer.prototype instanceof Uint8Array) {
          var t = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
          return Object.setPrototypeOf(t, Buffer.prototype), t;
        }
        for (var r = e.length, n = new Buffer(r), o = 0; o < r; o++)
          n[o] = e[o];
        return n;
      }),
      (t.bufferToUint8Array = function (e) {
        if (Buffer.prototype instanceof Uint8Array)
          return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
        for (var t = e.length, r = new Uint8Array(t), n = 0; n < t; n++)
          r[n] = e[n];
        return r;
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (o) {
    var e;
    ((e = o.CompressionCommon || (o.CompressionCommon = {})).getCroppedBuffer =
      function (e, t, r, n) {
        void 0 === n && (n = 0);
        n = new Uint8Array(r + n);
        return n.set(e.subarray(t, t + r)), n;
      }),
      (e.getCroppedAndAppendedByteArray = function (e, t, r, n) {
        return o.ArrayTools.concatUint8Arrays([e.subarray(t, t + r), n]);
      }),
      (e.detectCompressionSourceEncoding = function (e) {
        if (null == e)
          throw new TypeError(
            "detectCompressionSourceEncoding: input is null or undefined"
          );
        if ("string" == typeof e) return "String";
        if (
          e instanceof Uint8Array ||
          ("function" == typeof Buffer && Buffer.isBuffer(e))
        )
          return "ByteArray";
        throw new TypeError(
          "detectCompressionSourceEncoding: input must be of type 'string', 'Uint8Array' or 'Buffer'"
        );
      }),
      (e.encodeCompressedBytes = function (e, t) {
        switch (t) {
          case "ByteArray":
            return e;
          case "Buffer":
            return o.BufferTools.uint8ArrayToBuffer(e);
          case "Base64":
            return o.encodeBase64(e);
          case "BinaryString":
            return o.encodeBinaryString(e);
          case "StorageBinaryString":
            return o.encodeStorageBinaryString(e);
          default:
            throw new TypeError(
              "encodeCompressedBytes: invalid output encoding requested"
            );
        }
      }),
      (e.decodeCompressedBytes = function (e, t) {
        if (null == t)
          throw new TypeError(
            "decodeCompressedData: Input is null or undefined"
          );
        switch (t) {
          case "ByteArray":
          case "Buffer":
            var r = o.BufferTools.convertToUint8ArrayIfNeeded(e);
            if (!(r instanceof Uint8Array))
              throw new TypeError(
                "decodeCompressedData: 'ByteArray' or 'Buffer' input type was specified but input is not a Uint8Array or Buffer"
              );
            return r;
          case "Base64":
            if ("string" != typeof e)
              throw new TypeError(
                "decodeCompressedData: 'Base64' input type was specified but input is not a string"
              );
            return o.decodeBase64(e);
          case "BinaryString":
            if ("string" != typeof e)
              throw new TypeError(
                "decodeCompressedData: 'BinaryString' input type was specified but input is not a string"
              );
            return o.decodeBinaryString(e);
          case "StorageBinaryString":
            if ("string" != typeof e)
              throw new TypeError(
                "decodeCompressedData: 'StorageBinaryString' input type was specified but input is not a string"
              );
            return o.decodeStorageBinaryString(e);
          default:
            throw new TypeError(
              "decodeCompressedData: invalid input encoding requested: '" +
                t +
                "'"
            );
        }
      }),
      (e.encodeDecompressedBytes = function (e, t) {
        switch (t) {
          case "String":
            return o.decodeUTF8(e);
          case "ByteArray":
            return e;
          case "Buffer":
            if ("function" != typeof Buffer)
              throw new TypeError(
                "encodeDecompressedBytes: a 'Buffer' type was specified but is not supported at the current envirnment"
              );
            return o.BufferTools.uint8ArrayToBuffer(e);
          default:
            throw new TypeError(
              "encodeDecompressedBytes: invalid output encoding requested"
            );
        }
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (o) {
    var t, e, i, u;
    (e = t = o.EventLoop || (o.EventLoop = {})),
      (u = []),
      (e.enqueueImmediate = function (e) {
        u.push(e), 1 === u.length && i();
      }),
      (e.initializeScheduler = function () {
        function t() {
          for (var e = 0, t = u; e < t.length; e++) {
            var r = t[e];
            try {
              r.call(void 0);
            } catch (e) {
              o.printExceptionAndStackTraceToConsole(
                e,
                "enqueueImmediate exception"
              );
            }
          }
          u.length = 0;
        }
        var r, e, n;
        o.runningInNodeJS() &&
          (i = function () {
            return setImmediate(t);
          }),
          (i =
            "object" == typeof window &&
            "function" == typeof window.addEventListener &&
            "function" == typeof window.postMessage
              ? ((r = "enqueueImmediate-" + Math.random().toString()),
                window.addEventListener("message", function (e) {
                  e.data === r && t();
                }),
                (e = o.runningInNullOrigin() ? "*" : window.location.href),
                function () {
                  return window.postMessage(r, e);
                })
              : "function" == typeof MessageChannel &&
                "function" == typeof MessagePort
              ? (((n = new MessageChannel()).port1.onmessage = t),
                function () {
                  return n.port2.postMessage(0);
                })
              : function () {
                  return setTimeout(t, 0);
                });
      }),
      e.initializeScheduler(),
      (o.enqueueImmediate = function (e) {
        return t.enqueueImmediate(e);
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var r;
    ((r = e.ObjectTools || (e.ObjectTools = {})).override = function (e, t) {
      return r.extend(e, t);
    }),
      (r.extend = function (e, t) {
        if (null == e) throw new TypeError("obj is null or undefined");
        if ("object" != typeof e) throw new TypeError("obj is not an object");
        if ((null == t && (t = {}), "object" != typeof t))
          throw new TypeError("newProperties is not an object");
        if (null != t) for (var r in t) e[r] = t[r];
        return e;
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (o) {
    (o.getRandomIntegerInRange = function (e, t) {
      return e + Math.floor(Math.random() * (t - e));
    }),
      (o.getRandomUTF16StringOfLength = function (e) {
        for (var t = "", r = 0; r < e; r++) {
          for (
            var n = void 0;
            (n = o.getRandomIntegerInRange(0, 1114112)),
              55296 <= n && n <= 57343;

          );
          t += o.Encoding.CodePoint.decodeToString(n);
        }
        return t;
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var t =
      ((r.prototype.appendCharCode = function (e) {
        (this.outputBuffer[this.outputPosition++] = e),
          this.outputPosition === this.outputBufferCapacity &&
            this.flushBufferToOutputString();
      }),
      (r.prototype.appendCharCodes = function (e) {
        for (var t = 0, r = e.length; t < r; t++) this.appendCharCode(e[t]);
      }),
      (r.prototype.appendString = function (e) {
        for (var t = 0, r = e.length; t < r; t++)
          this.appendCharCode(e.charCodeAt(t));
      }),
      (r.prototype.appendCodePoint = function (e) {
        if (e <= 65535) this.appendCharCode(e);
        else {
          if (!(e <= 1114111))
            throw new Error(
              "appendCodePoint: A code point of " +
                e +
                " cannot be encoded in UTF-16"
            );
          this.appendCharCode(55296 + ((e - 65536) >>> 10)),
            this.appendCharCode(56320 + ((e - 65536) & 1023));
        }
      }),
      (r.prototype.getOutputString = function () {
        return this.flushBufferToOutputString(), this.outputString;
      }),
      (r.prototype.flushBufferToOutputString = function () {
        this.outputPosition === this.outputBufferCapacity
          ? (this.outputString += String.fromCharCode.apply(
              null,
              this.outputBuffer
            ))
          : (this.outputString += String.fromCharCode.apply(
              null,
              this.outputBuffer.subarray(0, this.outputPosition)
            )),
          (this.outputPosition = 0);
      }),
      r);
    function r(e) {
      void 0 === e && (e = 1024),
        (this.outputBufferCapacity = e),
        (this.outputPosition = 0),
        (this.outputString = ""),
        (this.outputBuffer = new Uint16Array(this.outputBufferCapacity));
    }
    e.StringBuilder = t;
  })((LZUTF8 = LZUTF8 || {})),
  (function (n) {
    var e =
      ((t.prototype.restart = function () {
        this.startTime = t.getTimestamp();
      }),
      (t.prototype.getElapsedTime = function () {
        return t.getTimestamp() - this.startTime;
      }),
      (t.prototype.getElapsedTimeAndRestart = function () {
        var e = this.getElapsedTime();
        return this.restart(), e;
      }),
      (t.prototype.logAndRestart = function (e, t) {
        void 0 === t && (t = !0);
        var r = this.getElapsedTime(),
          e = e + ": " + r.toFixed(3) + "ms";
        return n.log(e, t), this.restart(), r;
      }),
      (t.getTimestamp = function () {
        return (
          this.timestampFunc || this.createGlobalTimestampFunction(),
          this.timestampFunc()
        );
      }),
      (t.getMicrosecondTimestamp = function () {
        return Math.floor(1e3 * t.getTimestamp());
      }),
      (t.createGlobalTimestampFunction = function () {
        var t, e, r, n;
        "object" == typeof process && "function" == typeof process.hrtime
          ? ((t = 0),
            (this.timestampFunc = function () {
              var e = process.hrtime(),
                e = 1e3 * e[0] + e[1] / 1e6;
              return t + e;
            }),
            (t = Date.now() - this.timestampFunc()))
          : "object" == typeof chrome && chrome.Interval
          ? ((e = Date.now()),
            (r = new chrome.Interval()).start(),
            (this.timestampFunc = function () {
              return e + r.microseconds() / 1e3;
            }))
          : "object" == typeof performance && performance.now
          ? ((n = Date.now() - performance.now()),
            (this.timestampFunc = function () {
              return n + performance.now();
            }))
          : Date.now
          ? (this.timestampFunc = function () {
              return Date.now();
            })
          : (this.timestampFunc = function () {
              return new Date().getTime();
            });
      }),
      t);
    function t() {
      this.restart();
    }
    n.Timer = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (n) {
    var e =
      ((t.prototype.compressBlock = function (e) {
        if (null == e)
          throw new TypeError(
            "compressBlock: undefined or null input received"
          );
        return (
          "string" == typeof e && (e = n.encodeUTF8(e)),
          (e = n.BufferTools.convertToUint8ArrayIfNeeded(e)),
          this.compressUtf8Block(e)
        );
      }),
      (t.prototype.compressUtf8Block = function (e) {
        if (!e || 0 == e.length) return new Uint8Array(0);
        var t = this.cropAndAddNewBytesToInputBuffer(e),
          r = this.inputBuffer,
          n = this.inputBuffer.length;
        this.outputBuffer = new Uint8Array(e.length);
        for (var o = (this.outputBufferPosition = 0), i = t; i < n; i++) {
          var u,
            s,
            a = r[i],
            c = i < o;
          i > n - this.MinimumSequenceLength
            ? c || this.outputRawByte(a)
            : ((u = this.getBucketIndexForPrefix(i)),
              c ||
                (null != (s = this.findLongestMatch(i, u)) &&
                  (this.outputPointerBytes(s.length, s.distance),
                  (o = i + s.length),
                  (c = !0))),
              c || this.outputRawByte(a),
              (a = this.inputBufferStreamOffset + i),
              this.prefixHashTable.addValueToBucket(u, a));
        }
        return this.outputBuffer.subarray(0, this.outputBufferPosition);
      }),
      (t.prototype.findLongestMatch = function (e, t) {
        var r = this.prefixHashTable.getArraySegmentForBucketIndex(
          t,
          this.reusableArraySegmentObject
        );
        if (null == r) return null;
        for (var n, o = this.inputBuffer, i = 0, u = 0; u < r.length; u++) {
          var s = r.getInReversedOrder(u) - this.inputBufferStreamOffset,
            a = e - s,
            c = void 0,
            c =
              void 0 === n
                ? this.MinimumSequenceLength - 1
                : n < 128 && 128 <= a
                ? i + (i >>> 1)
                : i;
          if (
            a > this.MaximumMatchDistance ||
            c >= this.MaximumSequenceLength ||
            e + c >= o.length
          )
            break;
          if (o[s + c] === o[e + c])
            for (var f = 0; ; f++) {
              if (e + f === o.length || o[s + f] !== o[e + f]) {
                c < f && ((n = a), (i = f));
                break;
              }
              if (f === this.MaximumSequenceLength)
                return { distance: a, length: this.MaximumSequenceLength };
            }
        }
        return void 0 !== n ? { distance: n, length: i } : null;
      }),
      (t.prototype.getBucketIndexForPrefix = function (e) {
        return (
          (7880599 * this.inputBuffer[e] +
            39601 * this.inputBuffer[e + 1] +
            199 * this.inputBuffer[e + 2] +
            this.inputBuffer[e + 3]) %
          this.PrefixHashTableSize
        );
      }),
      (t.prototype.outputPointerBytes = function (e, t) {
        t < 128
          ? (this.outputRawByte(192 | e), this.outputRawByte(t))
          : (this.outputRawByte(224 | e),
            this.outputRawByte(t >>> 8),
            this.outputRawByte(255 & t));
      }),
      (t.prototype.outputRawByte = function (e) {
        this.outputBuffer[this.outputBufferPosition++] = e;
      }),
      (t.prototype.cropAndAddNewBytesToInputBuffer = function (e) {
        if (void 0 === this.inputBuffer) return (this.inputBuffer = e), 0;
        var t = Math.min(this.inputBuffer.length, this.MaximumMatchDistance),
          r = this.inputBuffer.length - t;
        return (
          (this.inputBuffer =
            n.CompressionCommon.getCroppedAndAppendedByteArray(
              this.inputBuffer,
              r,
              t,
              e
            )),
          (this.inputBufferStreamOffset += r),
          t
        );
      }),
      t);
    function t(e) {
      void 0 === e && (e = !0),
        (this.MinimumSequenceLength = 4),
        (this.MaximumSequenceLength = 31),
        (this.MaximumMatchDistance = 32767),
        (this.PrefixHashTableSize = 65537),
        (this.inputBufferStreamOffset = 1),
        e && "function" == typeof Uint32Array
          ? (this.prefixHashTable = new n.CompressorCustomHashTable(
              this.PrefixHashTableSize
            ))
          : (this.prefixHashTable = new n.CompressorSimpleHashTable(
              this.PrefixHashTableSize
            ));
    }
    n.Compressor = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (s) {
    var e =
      ((t.prototype.addValueToBucket = function (e, t) {
        (e <<= 1),
          this.storageIndex >= this.storage.length >>> 1 && this.compact();
        var r,
          n,
          o = this.bucketLocators[e];
        0 === o
          ? ((o = this.storageIndex),
            (r = 1),
            (this.storage[this.storageIndex] = t),
            (this.storageIndex += this.minimumBucketCapacity))
          : ((r = this.bucketLocators[e + 1]) ===
              this.maximumBucketCapacity - 1 &&
              (r = this.truncateBucketToNewerElements(
                o,
                r,
                this.maximumBucketCapacity / 2
              )),
            (n = o + r),
            0 === this.storage[n]
              ? ((this.storage[n] = t),
                n === this.storageIndex && (this.storageIndex += r))
              : (s.ArrayTools.copyElements(
                  this.storage,
                  o,
                  this.storage,
                  this.storageIndex,
                  r
                ),
                (o = this.storageIndex),
                (this.storageIndex += r),
                (this.storage[this.storageIndex++] = t),
                (this.storageIndex += r)),
            r++),
          (this.bucketLocators[e] = o),
          (this.bucketLocators[e + 1] = r);
      }),
      (t.prototype.truncateBucketToNewerElements = function (e, t, r) {
        var n = e + t - r;
        return (
          s.ArrayTools.copyElements(this.storage, n, this.storage, e, r),
          s.ArrayTools.zeroElements(this.storage, e + r, t - r),
          r
        );
      }),
      (t.prototype.compact = function () {
        var e = this.bucketLocators,
          t = this.storage;
        (this.bucketLocators = new Uint32Array(this.bucketLocators.length)),
          (this.storageIndex = 1);
        for (var r = 0; r < e.length; r += 2) {
          var n = e[r + 1];
          0 !== n &&
            ((this.bucketLocators[r] = this.storageIndex),
            (this.bucketLocators[r + 1] = n),
            (this.storageIndex += Math.max(
              Math.min(2 * n, this.maximumBucketCapacity),
              this.minimumBucketCapacity
            )));
        }
        this.storage = new Uint32Array(8 * this.storageIndex);
        for (r = 0; r < e.length; r += 2) {
          var o,
            i,
            u = e[r];
          0 !== u &&
            ((o = this.bucketLocators[r]),
            (i = this.bucketLocators[r + 1]),
            s.ArrayTools.copyElements(t, u, this.storage, o, i));
        }
      }),
      (t.prototype.getArraySegmentForBucketIndex = function (e, t) {
        e <<= 1;
        var r = this.bucketLocators[e];
        return 0 === r
          ? null
          : (void 0 === t &&
              (t = new s.ArraySegment(
                this.storage,
                r,
                this.bucketLocators[e + 1]
              )),
            t);
      }),
      (t.prototype.getUsedBucketCount = function () {
        return Math.floor(
          s.ArrayTools.countNonzeroValuesInArray(this.bucketLocators) / 2
        );
      }),
      (t.prototype.getTotalElementCount = function () {
        for (var e = 0, t = 0; t < this.bucketLocators.length; t += 2)
          e += this.bucketLocators[t + 1];
        return e;
      }),
      t);
    function t(e) {
      (this.minimumBucketCapacity = 4),
        (this.maximumBucketCapacity = 64),
        (this.bucketLocators = new Uint32Array(2 * e)),
        (this.storage = new Uint32Array(2 * e)),
        (this.storageIndex = 1);
    }
    s.CompressorCustomHashTable = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (n) {
    var e =
      ((t.prototype.addValueToBucket = function (e, t) {
        var r = this.buckets[e];
        void 0 === r
          ? (this.buckets[e] = [t])
          : (r.length === this.maximumBucketCapacity - 1 &&
              n.ArrayTools.truncateStartingElements(
                r,
                this.maximumBucketCapacity / 2
              ),
            r.push(t));
      }),
      (t.prototype.getArraySegmentForBucketIndex = function (e, t) {
        e = this.buckets[e];
        return void 0 === e
          ? null
          : (void 0 === t && (t = new n.ArraySegment(e, 0, e.length)), t);
      }),
      (t.prototype.getUsedBucketCount = function () {
        return n.ArrayTools.countNonzeroValuesInArray(this.buckets);
      }),
      (t.prototype.getTotalElementCount = function () {
        for (var e = 0, t = 0; t < this.buckets.length; t++)
          void 0 !== this.buckets[t] && (e += this.buckets[t].length);
        return e;
      }),
      t);
    function t(e) {
      (this.maximumBucketCapacity = 64), (this.buckets = new Array(e));
    }
    n.CompressorSimpleHashTable = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (f) {
    var e =
      ((t.prototype.decompressBlockToString = function (e) {
        return (
          (e = f.BufferTools.convertToUint8ArrayIfNeeded(e)),
          f.decodeUTF8(this.decompressBlock(e))
        );
      }),
      (t.prototype.decompressBlock = function (e) {
        this.inputBufferRemainder &&
          ((e = f.ArrayTools.concatUint8Arrays([this.inputBufferRemainder, e])),
          (this.inputBufferRemainder = void 0));
        for (
          var t = this.cropOutputBufferToWindowAndInitialize(
              Math.max(4 * e.length, 1024)
            ),
            r = 0,
            n = e.length;
          r < n;
          r++
        ) {
          var o = e[r];
          if (o >>> 6 == 3) {
            var i = o >>> 5;
            if (r == n - 1 || (r == n - 2 && 7 == i)) {
              this.inputBufferRemainder = e.subarray(r);
              break;
            }
            if (e[r + 1] >>> 7 == 1) this.outputByte(o);
            else {
              var u = 31 & o,
                s = void 0;
              6 == i
                ? ((s = e[r + 1]), (r += 1))
                : ((s = (e[r + 1] << 8) | e[r + 2]), (r += 2));
              for (var a = this.outputPosition - s, c = 0; c < u; c++)
                this.outputByte(this.outputBuffer[a + c]);
            }
          } else this.outputByte(o);
        }
        return (
          this.rollBackIfOutputBufferEndsWithATruncatedMultibyteSequence(),
          f.CompressionCommon.getCroppedBuffer(
            this.outputBuffer,
            t,
            this.outputPosition - t
          )
        );
      }),
      (t.prototype.outputByte = function (e) {
        this.outputPosition === this.outputBuffer.length &&
          (this.outputBuffer = f.ArrayTools.doubleByteArrayCapacity(
            this.outputBuffer
          )),
          (this.outputBuffer[this.outputPosition++] = e);
      }),
      (t.prototype.cropOutputBufferToWindowAndInitialize = function (e) {
        if (!this.outputBuffer)
          return (this.outputBuffer = new Uint8Array(e)), 0;
        var t = Math.min(this.outputPosition, this.MaximumMatchDistance);
        if (
          ((this.outputBuffer = f.CompressionCommon.getCroppedBuffer(
            this.outputBuffer,
            this.outputPosition - t,
            t,
            e
          )),
          (this.outputPosition = t),
          this.outputBufferRemainder)
        ) {
          for (var r = 0; r < this.outputBufferRemainder.length; r++)
            this.outputByte(this.outputBufferRemainder[r]);
          this.outputBufferRemainder = void 0;
        }
        return t;
      }),
      (t.prototype.rollBackIfOutputBufferEndsWithATruncatedMultibyteSequence =
        function () {
          for (var e = 1; e <= 4 && 0 <= this.outputPosition - e; e++) {
            var t = this.outputBuffer[this.outputPosition - e];
            if (
              (e < 4 && t >>> 3 == 30) ||
              (e < 3 && t >>> 4 == 14) ||
              (e < 2 && t >>> 5 == 6)
            )
              return (
                (this.outputBufferRemainder = this.outputBuffer.subarray(
                  this.outputPosition - e,
                  this.outputPosition
                )),
                void (this.outputPosition -= e)
              );
          }
        }),
      t);
    function t() {
      (this.MaximumMatchDistance = 32767), (this.outputPosition = 0);
    }
    f.Decompressor = e;
  })((LZUTF8 = LZUTF8 || {})),
  (function (s) {
    var e, t, a, c;
    (e = s.Encoding || (s.Encoding = {})),
      (t = e.Base64 || (e.Base64 = {})),
      (a = new Uint8Array([
        65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82,
        83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102, 103, 104,
        105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
        119, 120, 121, 122, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 43, 47,
      ])),
      (c = new Uint8Array([
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 62, 255, 255, 255, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255,
        255, 255, 0, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
        13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255,
        255, 255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 255, 255, 255, 255,
      ])),
      (t.encode = function (e) {
        return e && 0 != e.length
          ? s.runningInNodeJS()
            ? s.BufferTools.uint8ArrayToBuffer(e).toString("base64")
            : t.encodeWithJS(e)
          : "";
      }),
      (t.decode = function (e) {
        return e
          ? s.runningInNodeJS()
            ? s.BufferTools.bufferToUint8Array(Buffer.from(e, "base64"))
            : t.decodeWithJS(e)
          : new Uint8Array(0);
      }),
      (t.encodeWithJS = function (e, t) {
        if ((void 0 === t && (t = !0), !e || 0 == e.length)) return "";
        for (
          var r, n = a, o = new s.StringBuilder(), i = 0, u = e.length;
          i < u;
          i += 3
        )
          i <= u - 3
            ? ((r = (e[i] << 16) | (e[i + 1] << 8) | e[i + 2]),
              o.appendCharCode(n[(r >>> 18) & 63]),
              o.appendCharCode(n[(r >>> 12) & 63]),
              o.appendCharCode(n[(r >>> 6) & 63]),
              o.appendCharCode(n[63 & r]),
              (r = 0))
            : i === u - 2
            ? ((r = (e[i] << 16) | (e[i + 1] << 8)),
              o.appendCharCode(n[(r >>> 18) & 63]),
              o.appendCharCode(n[(r >>> 12) & 63]),
              o.appendCharCode(n[(r >>> 6) & 63]),
              t && o.appendCharCode(61))
            : i === u - 1 &&
              ((r = e[i] << 16),
              o.appendCharCode(n[(r >>> 18) & 63]),
              o.appendCharCode(n[(r >>> 12) & 63]),
              t && (o.appendCharCode(61), o.appendCharCode(61)));
        return o.getOutputString();
      }),
      (t.decodeWithJS = function (e, t) {
        if (!e || 0 == e.length) return new Uint8Array(0);
        var r = e.length % 4;
        if (1 == r) throw new Error("Invalid Base64 string: length % 4 == 1");
        2 == r ? (e += "==") : 3 == r && (e += "="),
          (t = t || new Uint8Array(e.length));
        for (var n = 0, o = e.length, i = 0; i < o; i += 4) {
          var u =
            (c[e.charCodeAt(i)] << 18) |
            (c[e.charCodeAt(i + 1)] << 12) |
            (c[e.charCodeAt(i + 2)] << 6) |
            c[e.charCodeAt(i + 3)];
          (t[n++] = (u >>> 16) & 255),
            (t[n++] = (u >>> 8) & 255),
            (t[n++] = 255 & u);
        }
        return (
          61 == e.charCodeAt(o - 1) && n--,
          61 == e.charCodeAt(o - 2) && n--,
          t.subarray(0, n)
        );
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (s) {
    var e;
    ((e =
      (e = s.Encoding || (s.Encoding = {})).BinaryString ||
      (e.BinaryString = {})).encode = function (e) {
      if (null == e)
        throw new TypeError(
          "BinaryString.encode: undefined or null input received"
        );
      if (0 === e.length) return "";
      for (
        var t = e.length, r = new s.StringBuilder(), n = 0, o = 1, i = 0;
        i < t;
        i += 2
      ) {
        var u = void 0,
          u = i == t - 1 ? e[i] << 8 : (e[i] << 8) | e[i + 1];
        r.appendCharCode((n << (16 - o)) | (u >>> o)),
          (n = u & ((1 << o) - 1)),
          15 === o ? (r.appendCharCode(n), (n = 0), (o = 1)) : (o += 1),
          t - 2 <= i && r.appendCharCode(n << (16 - o));
      }
      return r.appendCharCode(32768 | t % 2), r.getOutputString();
    }),
      (e.decode = function (e) {
        if ("string" != typeof e)
          throw new TypeError("BinaryString.decode: invalid input type");
        if ("" == e) return new Uint8Array(0);
        for (
          var t, r = new Uint8Array(3 * e.length), n = 0, o = 0, i = 0, u = 0;
          u < e.length;
          u++
        ) {
          var s = e.charCodeAt(u);
          32768 <= s
            ? (32769 == s && n--, (i = 0))
            : ((o =
                0 == i
                  ? s
                  : ((t = (o << i) | (s >>> (15 - i))),
                    (r[n++] = t >>> 8),
                    (r[n++] = 255 & t),
                    s & ((1 << (15 - i)) - 1))),
              15 == i ? (i = 0) : (i += 1));
        }
        return r.subarray(0, n);
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    ((e =
      (e = e.Encoding || (e.Encoding = {})).CodePoint ||
      (e.CodePoint = {})).encodeFromString = function (e, t) {
      var r = e.charCodeAt(t);
      if (r < 55296 || 56319 < r) return r;
      t = e.charCodeAt(t + 1);
      if (56320 <= t && t <= 57343)
        return t - 56320 + ((r - 55296) << 10) + 65536;
      throw new Error(
        "getUnicodeCodePoint: Received a lead surrogate character, char code " +
          r +
          ", followed by " +
          t +
          ", which is not a trailing surrogate character code."
      );
    }),
      (e.decodeToString = function (e) {
        if (e <= 65535) return String.fromCharCode(e);
        if (e <= 1114111)
          return String.fromCharCode(
            55296 + ((e - 65536) >>> 10),
            56320 + ((e - 65536) & 1023)
          );
        throw new Error(
          "getStringFromUnicodeCodePoint: A code point of " +
            e +
            " cannot be encoded in UTF-16"
        );
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var n;
    (e =
      (e = e.Encoding || (e.Encoding = {})).DecimalString ||
      (e.DecimalString = {})),
      (n = [
        "000",
        "001",
        "002",
        "003",
        "004",
        "005",
        "006",
        "007",
        "008",
        "009",
        "010",
        "011",
        "012",
        "013",
        "014",
        "015",
        "016",
        "017",
        "018",
        "019",
        "020",
        "021",
        "022",
        "023",
        "024",
        "025",
        "026",
        "027",
        "028",
        "029",
        "030",
        "031",
        "032",
        "033",
        "034",
        "035",
        "036",
        "037",
        "038",
        "039",
        "040",
        "041",
        "042",
        "043",
        "044",
        "045",
        "046",
        "047",
        "048",
        "049",
        "050",
        "051",
        "052",
        "053",
        "054",
        "055",
        "056",
        "057",
        "058",
        "059",
        "060",
        "061",
        "062",
        "063",
        "064",
        "065",
        "066",
        "067",
        "068",
        "069",
        "070",
        "071",
        "072",
        "073",
        "074",
        "075",
        "076",
        "077",
        "078",
        "079",
        "080",
        "081",
        "082",
        "083",
        "084",
        "085",
        "086",
        "087",
        "088",
        "089",
        "090",
        "091",
        "092",
        "093",
        "094",
        "095",
        "096",
        "097",
        "098",
        "099",
        "100",
        "101",
        "102",
        "103",
        "104",
        "105",
        "106",
        "107",
        "108",
        "109",
        "110",
        "111",
        "112",
        "113",
        "114",
        "115",
        "116",
        "117",
        "118",
        "119",
        "120",
        "121",
        "122",
        "123",
        "124",
        "125",
        "126",
        "127",
        "128",
        "129",
        "130",
        "131",
        "132",
        "133",
        "134",
        "135",
        "136",
        "137",
        "138",
        "139",
        "140",
        "141",
        "142",
        "143",
        "144",
        "145",
        "146",
        "147",
        "148",
        "149",
        "150",
        "151",
        "152",
        "153",
        "154",
        "155",
        "156",
        "157",
        "158",
        "159",
        "160",
        "161",
        "162",
        "163",
        "164",
        "165",
        "166",
        "167",
        "168",
        "169",
        "170",
        "171",
        "172",
        "173",
        "174",
        "175",
        "176",
        "177",
        "178",
        "179",
        "180",
        "181",
        "182",
        "183",
        "184",
        "185",
        "186",
        "187",
        "188",
        "189",
        "190",
        "191",
        "192",
        "193",
        "194",
        "195",
        "196",
        "197",
        "198",
        "199",
        "200",
        "201",
        "202",
        "203",
        "204",
        "205",
        "206",
        "207",
        "208",
        "209",
        "210",
        "211",
        "212",
        "213",
        "214",
        "215",
        "216",
        "217",
        "218",
        "219",
        "220",
        "221",
        "222",
        "223",
        "224",
        "225",
        "226",
        "227",
        "228",
        "229",
        "230",
        "231",
        "232",
        "233",
        "234",
        "235",
        "236",
        "237",
        "238",
        "239",
        "240",
        "241",
        "242",
        "243",
        "244",
        "245",
        "246",
        "247",
        "248",
        "249",
        "250",
        "251",
        "252",
        "253",
        "254",
        "255",
      ]),
      (e.encode = function (e) {
        for (var t = [], r = 0; r < e.length; r++) t.push(n[e[r]]);
        return t.join(" ");
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (e) {
    var t;
    ((e =
      (t = e.Encoding || (e.Encoding = {})).StorageBinaryString ||
      (t.StorageBinaryString = {})).encode = function (e) {
      return t.BinaryString.encode(e).replace(/\0/g, "耂");
    }),
      (e.decode = function (e) {
        return t.BinaryString.decode(e.replace(/\u8002/g, "\0"));
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (a) {
    var i, t, r, n;
    (i = a.Encoding || (a.Encoding = {})),
      ((t = i.UTF8 || (i.UTF8 = {})).encode = function (e) {
        return e && 0 != e.length
          ? a.runningInNodeJS()
            ? a.BufferTools.bufferToUint8Array(Buffer.from(e, "utf8"))
            : t.createNativeTextEncoderAndDecoderIfAvailable()
            ? r.encode(e)
            : t.encodeWithJS(e)
          : new Uint8Array(0);
      }),
      (t.decode = function (e) {
        return e && 0 != e.length
          ? a.runningInNodeJS()
            ? a.BufferTools.uint8ArrayToBuffer(e).toString("utf8")
            : t.createNativeTextEncoderAndDecoderIfAvailable()
            ? n.decode(e)
            : t.decodeWithJS(e)
          : "";
      }),
      (t.encodeWithJS = function (e, t) {
        if (!e || 0 == e.length) return new Uint8Array(0);
        t = t || new Uint8Array(4 * e.length);
        for (var r = 0, n = 0; n < e.length; n++) {
          var o = i.CodePoint.encodeFromString(e, n);
          if (o <= 127) t[r++] = o;
          else if (o <= 2047)
            (t[r++] = 192 | (o >>> 6)), (t[r++] = 128 | (63 & o));
          else if (o <= 65535)
            (t[r++] = 224 | (o >>> 12)),
              (t[r++] = 128 | ((o >>> 6) & 63)),
              (t[r++] = 128 | (63 & o));
          else {
            if (!(o <= 1114111))
              throw new Error(
                "Invalid UTF-16 string: Encountered a character unsupported by UTF-8/16 (RFC 3629)"
              );
            (t[r++] = 240 | (o >>> 18)),
              (t[r++] = 128 | ((o >>> 12) & 63)),
              (t[r++] = 128 | ((o >>> 6) & 63)),
              (t[r++] = 128 | (63 & o)),
              n++;
          }
        }
        return t.subarray(0, r);
      }),
      (t.decodeWithJS = function (e, t, r) {
        if ((void 0 === t && (t = 0), !e || 0 == e.length)) return "";
        void 0 === r && (r = e.length);
        for (var n, o, i = new a.StringBuilder(), u = t, s = r; u < s; ) {
          if ((o = e[u]) >>> 7 == 0) (n = o), (u += 1);
          else if (o >>> 5 == 6) {
            if (r <= u + 1)
              throw new Error(
                "Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " +
                  u
              );
            (n = ((31 & o) << 6) | (63 & e[u + 1])), (u += 2);
          } else if (o >>> 4 == 14) {
            if (r <= u + 2)
              throw new Error(
                "Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " +
                  u
              );
            (n = ((15 & o) << 12) | ((63 & e[u + 1]) << 6) | (63 & e[u + 2])),
              (u += 3);
          } else {
            if (o >>> 3 != 30)
              throw new Error(
                "Invalid UTF-8 stream: An invalid lead byte value encountered at position " +
                  u
              );
            if (r <= u + 3)
              throw new Error(
                "Invalid UTF-8 stream: Truncated codepoint sequence encountered at position " +
                  u
              );
            (n =
              ((7 & o) << 18) |
              ((63 & e[u + 1]) << 12) |
              ((63 & e[u + 2]) << 6) |
              (63 & e[u + 3])),
              (u += 4);
          }
          i.appendCodePoint(n);
        }
        return i.getOutputString();
      }),
      (t.createNativeTextEncoderAndDecoderIfAvailable = function () {
        return (
          !!r ||
          ("function" == typeof TextEncoder &&
            ((r = new TextEncoder("utf-8")),
            (n = new TextDecoder("utf-8")),
            !0))
        );
      });
  })((LZUTF8 = LZUTF8 || {})),
  (function (o) {
    (o.compress = function (e, t) {
      if ((void 0 === t && (t = {}), null == e))
        throw new TypeError("compress: undefined or null input received");
      var r = o.CompressionCommon.detectCompressionSourceEncoding(e);
      return (
        (t = o.ObjectTools.override(
          { inputEncoding: r, outputEncoding: "ByteArray" },
          t
        )),
        (e = new o.Compressor().compressBlock(e)),
        o.CompressionCommon.encodeCompressedBytes(e, t.outputEncoding)
      );
    }),
      (o.decompress = function (e, t) {
        if ((void 0 === t && (t = {}), null == e))
          throw new TypeError("decompress: undefined or null input received");
        return (
          (t = o.ObjectTools.override(
            { inputEncoding: "ByteArray", outputEncoding: "String" },
            t
          )),
          (e = o.CompressionCommon.decodeCompressedBytes(e, t.inputEncoding)),
          (e = new o.Decompressor().decompressBlock(e)),
          o.CompressionCommon.encodeDecompressedBytes(e, t.outputEncoding)
        );
      }),
      (o.compressAsync = function (e, t, r) {
        var n;
        null == r && (r = function () {});
        try {
          n = o.CompressionCommon.detectCompressionSourceEncoding(e);
        } catch (e) {
          return void r(void 0, e);
        }
        (t = o.ObjectTools.override(
          {
            inputEncoding: n,
            outputEncoding: "ByteArray",
            useWebWorker: !0,
            blockSize: 65536,
          },
          t
        )),
          o.enqueueImmediate(function () {
            (t.useWebWorker && o.WebWorker.createGlobalWorkerIfNeeded()
              ? o.WebWorker
              : o.AsyncCompressor
            ).compressAsync(e, t, r);
          });
      }),
      (o.decompressAsync = function (e, t, r) {
        var n;
        null == r && (r = function () {}),
          null != e
            ? ((t = o.ObjectTools.override(
                {
                  inputEncoding: "ByteArray",
                  outputEncoding: "String",
                  useWebWorker: !0,
                  blockSize: 65536,
                },
                t
              )),
              (n = o.BufferTools.convertToUint8ArrayIfNeeded(e)),
              o.EventLoop.enqueueImmediate(function () {
                t.useWebWorker && o.WebWorker.createGlobalWorkerIfNeeded()
                  ? o.WebWorker.decompressAsync(n, t, r)
                  : o.AsyncDecompressor.decompressAsync(e, t, r);
              }))
            : r(
                void 0,
                new TypeError(
                  "decompressAsync: undefined or null input received"
                )
              );
      }),
      (o.createCompressionStream = function () {
        return o.AsyncCompressor.createCompressionStream();
      }),
      (o.createDecompressionStream = function () {
        return o.AsyncDecompressor.createDecompressionStream();
      }),
      (o.encodeUTF8 = function (e) {
        return o.Encoding.UTF8.encode(e);
      }),
      (o.decodeUTF8 = function (e) {
        return o.Encoding.UTF8.decode(e);
      }),
      (o.encodeBase64 = function (e) {
        return o.Encoding.Base64.encode(e);
      }),
      (o.decodeBase64 = function (e) {
        return o.Encoding.Base64.decode(e);
      }),
      (o.encodeBinaryString = function (e) {
        return o.Encoding.BinaryString.encode(e);
      }),
      (o.decodeBinaryString = function (e) {
        return o.Encoding.BinaryString.decode(e);
      }),
      (o.encodeStorageBinaryString = function (e) {
        return o.Encoding.StorageBinaryString.encode(e);
      }),
      (o.decodeStorageBinaryString = function (e) {
        return o.Encoding.StorageBinaryString.decode(e);
      });
  })((LZUTF8 = LZUTF8 || {}));

const relaxData = (message) => {
  const decompressedMessage = LZUTF8.decompress(message);
  // const decryptedMessage = CryptoJS.AES.decrypt(
  //   decompressedMessage,
  //   "secret"
  // ).toString(CryptoJS.enc.Utf8);
  // return decryptedMessage;

  return decompressedMessage;
};
const compressData = (message) => {
  // const encryptedMessage = CryptoJS.AES.encrypt(
  //   JSON.stringify(message),
  //   "secret"
  // ).toString();
  // const compressedMessage = LZUTF8.compress(encryptedMessage);
  const compressedMessage = LZUTF8.compress(JSON.stringify(message));
  return compressedMessage;
};

/*******************************************************************************
 * Copyright (c) 2013 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution.
 *
 * The Eclipse Public License is available at
 *    http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at
 *   http://www.eclipse.org/org/documents/edl-v10.php.
 *
 * Contributors:
 *    Andrew Banks - initial API and implementation and initial documentation
 *******************************************************************************/

// Only expose a single object name in the global namespace.
// Everything must go through this module. Global Paho.MQTT module
// only has a single public function, client, which returns
// a Paho.MQTT client object given connection details.

/**
 * Send and receive messages using web browsers.
 * <p> 
 * This programming interface lets a JavaScript client application use the MQTT V3.1 or
 * V3.1.1 protocol to connect to an MQTT-supporting messaging server.
 *  
 * The function supported includes:
 * <ol>
 * <li>Connecting to and disconnecting from a server. The server is identified by its host name and port number. 
 * <li>Specifying options that relate to the communications link with the server, 
 * for example the frequency of keep-alive heartbeats, and whether SSL/TLS is required.
 * <li>Subscribing to and receiving messages from MQTT Topics.
 * <li>Publishing messages to MQTT Topics.
 * </ol>
 * <p>
 * The API consists of two main objects:
 * <dl>
 * <dt><b>{@link Paho.MQTT.Client}</b></dt>
 * <dd>This contains methods that provide the functionality of the API,
 * including provision of callbacks that notify the application when a message
 * arrives from or is delivered to the messaging server,
 * or when the status of its connection to the messaging server changes.</dd>
 * <dt><b>{@link Paho.MQTT.Message}</b></dt>
 * <dd>This encapsulates the payload of the message along with various attributes
 * associated with its delivery, in particular the destination to which it has
 * been (or is about to be) sent.</dd>
 * </dl> 
 * <p>
 * The programming interface validates parameters passed to it, and will throw
 * an Error containing an error message intended for developer use, if it detects
 * an error with any parameter.
 * <p>
 * Example:
 * 
 * <code><pre>
client = new Paho.MQTT.Client(location.hostname, Number(location.port), "clientId");
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;
client.connect({onSuccess:onConnect});

function onConnect() {
  // Once a connection has been made, make a subscription and send a message.
  console.log("onConnect");
  client.subscribe("/World");
  message = new Paho.MQTT.Message("Hello");
  message.destinationName = "/World";
  client.send(message); 
};
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0)
	console.log("onConnectionLost:"+responseObject.errorMessage);
};
function onMessageArrived(message) {
  console.log("onMessageArrived:"+message.payloadString);
  client.disconnect(); 
};	
 * </pre></code>
 * @namespace Paho.MQTT 
 */

if (typeof Paho === "undefined") {
  Paho = {};
}

Paho.MQTT = (function (global) {
  // Private variables below, these are only visible inside the function closure
  // which is used to define the module.

  var version = "@VERSION@";
  var buildLevel = "@BUILDLEVEL@";

  /**
   * Unique message type identifiers, with associated
   * associated integer values.
   * @private
   */
  var MESSAGE_TYPE = {
    CONNECT: 1,
    CONNACK: 2,
    PUBLISH: 3,
    PUBACK: 4,
    PUBREC: 5,
    PUBREL: 6,
    PUBCOMP: 7,
    SUBSCRIBE: 8,
    SUBACK: 9,
    UNSUBSCRIBE: 10,
    UNSUBACK: 11,
    PINGREQ: 12,
    PINGRESP: 13,
    DISCONNECT: 14,
  };

  // Collection of utility methods used to simplify module code
  // and promote the DRY pattern.

  /**
   * Validate an object's parameter names to ensure they
   * match a list of expected variables name for this option
   * type. Used to ensure option object passed into the API don't
   * contain erroneous parameters.
   * @param {Object} obj - User options object
   * @param {Object} keys - valid keys and types that may exist in obj.
   * @throws {Error} Invalid option parameter found.
   * @private
   */
  var validate = function (obj, keys) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (keys.hasOwnProperty(key)) {
          if (typeof obj[key] !== keys[key])
            throw new Error(format(ERROR.INVALID_TYPE, [typeof obj[key], key]));
        } else {
          var errorStr = "Unknown property, " + key + ". Valid properties are:";
          for (var key in keys)
            if (keys.hasOwnProperty(key)) errorStr = errorStr + " " + key;
          throw new Error(errorStr);
        }
      }
    }
  };

  /**
   * Return a new function which runs the user function bound
   * to a fixed scope.
   * @param {function} User function
   * @param {object} Function scope
   * @return {function} User function bound to another scope
   * @private
   */
  var scope = function (f, scope) {
    return function () {
      return f.apply(scope, arguments);
    };
  };

  /**
   * Unique message type identifiers, with associated
   * associated integer values.
   * @private
   */
  var ERROR = {
    OK: { code: 0, text: "AMQJSC0000I OK." },
    CONNECT_TIMEOUT: { code: 1, text: "AMQJSC0001E Connect timed out." },
    SUBSCRIBE_TIMEOUT: { code: 2, text: "AMQJS0002E Subscribe timed out." },
    UNSUBSCRIBE_TIMEOUT: { code: 3, text: "AMQJS0003E Unsubscribe timed out." },
    PING_TIMEOUT: { code: 4, text: "AMQJS0004E Ping timed out." },
    INTERNAL_ERROR: {
      code: 5,
      text: "AMQJS0005E Internal error. Error Message: {0}, Stack trace: {1}",
    },
    CONNACK_RETURNCODE: {
      code: 6,
      text: "AMQJS0006E Bad Connack return code:{0} {1}.",
    },
    SOCKET_ERROR: { code: 7, text: "AMQJS0007E Socket error:{0}." },
    SOCKET_CLOSE: { code: 8, text: "AMQJS0008I Socket closed." },
    MALFORMED_UTF: {
      code: 9,
      text: "AMQJS0009E Malformed UTF data:{0} {1} {2}.",
    },
    UNSUPPORTED: {
      code: 10,
      text: "AMQJS0010E {0} is not supported by this browser.",
    },
    INVALID_STATE: { code: 11, text: "AMQJS0011E Invalid state {0}." },
    INVALID_TYPE: { code: 12, text: "AMQJS0012E Invalid type {0} for {1}." },
    INVALID_ARGUMENT: {
      code: 13,
      text: "AMQJS0013E Invalid argument {0} for {1}.",
    },
    UNSUPPORTED_OPERATION: {
      code: 14,
      text: "AMQJS0014E Unsupported operation.",
    },
    INVALID_STORED_DATA: {
      code: 15,
      text: "AMQJS0015E Invalid data in local storage key={0} value={1}.",
    },
    INVALID_MQTT_MESSAGE_TYPE: {
      code: 16,
      text: "AMQJS0016E Invalid MQTT message type {0}.",
    },
    MALFORMED_UNICODE: {
      code: 17,
      text: "AMQJS0017E Malformed Unicode string:{0} {1}.",
    },
  };

  /** CONNACK RC Meaning. */
  var CONNACK_RC = {
    0: "Connection Accepted",
    1: "Connection Refused: unacceptable protocol version",
    2: "Connection Refused: identifier rejected",
    3: "Connection Refused: server unavailable",
    4: "Connection Refused: bad user name or password",
    5: "Connection Refused: not authorized",
  };

  /**
   * Format an error message text.
   * @private
   * @param {error} ERROR.KEY value above.
   * @param {substitutions} [array] substituted into the text.
   * @return the text with the substitutions made.
   */
  var format = function (error, substitutions) {
    var text = error.text;
    if (substitutions) {
      var field, start;
      for (var i = 0; i < substitutions.length; i++) {
        field = "{" + i + "}";
        start = text.indexOf(field);
        if (start > 0) {
          var part1 = text.substring(0, start);
          var part2 = text.substring(start + field.length);
          text = part1 + substitutions[i] + part2;
        }
      }
    }
    return text;
  };

  //MQTT protocol and version          6    M    Q    I    s    d    p    3
  var MqttProtoIdentifierv3 = [
    0x00, 0x06, 0x4d, 0x51, 0x49, 0x73, 0x64, 0x70, 0x03,
  ];
  //MQTT proto/version for 311         4    M    Q    T    T    4
  var MqttProtoIdentifierv4 = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04];

  /**
   * Construct an MQTT wire protocol message.
   * @param type MQTT packet type.
   * @param options optional wire message attributes.
   *
   * Optional properties
   *
   * messageIdentifier: message ID in the range [0..65535]
   * payloadMessage:	Application Message - PUBLISH only
   * connectStrings:	array of 0 or more Strings to be put into the CONNECT payload
   * topics:			array of strings (SUBSCRIBE, UNSUBSCRIBE)
   * requestQoS:		array of QoS values [0..2]
   *
   * "Flag" properties
   * cleanSession:	true if present / false if absent (CONNECT)
   * willMessage:  	true if present / false if absent (CONNECT)
   * isRetained:		true if present / false if absent (CONNECT)
   * userName:		true if present / false if absent (CONNECT)
   * password:		true if present / false if absent (CONNECT)
   * keepAliveInterval:	integer [0..65535]  (CONNECT)
   *
   * @private
   * @ignore
   */
  var WireMessage = function (type, options) {
    this.type = type;
    for (var name in options) {
      if (options.hasOwnProperty(name)) {
        this[name] = options[name];
      }
    }
  };

  WireMessage.prototype.encode = function () {
    // Compute the first byte of the fixed header
    var first = (this.type & 0x0f) << 4;

    /*
     * Now calculate the length of the variable header + payload by adding up the lengths
     * of all the component parts
     */

    var remLength = 0;
    var topicStrLength = new Array();
    var destinationNameLength = 0;

    // if the message contains a messageIdentifier then we need two bytes for that
    if (this.messageIdentifier != undefined) remLength += 2;

    switch (this.type) {
      // If this a Connect then we need to include 12 bytes for its header
      case MESSAGE_TYPE.CONNECT:
        switch (this.mqttVersion) {
          case 3:
            remLength += MqttProtoIdentifierv3.length + 3;
            break;
          case 4:
            remLength += MqttProtoIdentifierv4.length + 3;
            break;
        }

        remLength += UTF8Length(this.clientId) + 2;
        if (this.willMessage != undefined) {
          remLength += UTF8Length(this.willMessage.destinationName) + 2;
          // Will message is always a string, sent as UTF-8 characters with a preceding length.
          var willMessagePayloadBytes = this.willMessage.payloadBytes;
          if (!(willMessagePayloadBytes instanceof Uint8Array))
            willMessagePayloadBytes = new Uint8Array(payloadBytes);
          remLength += willMessagePayloadBytes.byteLength + 2;
        }
        if (this.userName != undefined)
          remLength += UTF8Length(this.userName) + 2;
        if (this.password != undefined)
          remLength += UTF8Length(this.password) + 2;
        break;

      // Subscribe, Unsubscribe can both contain topic strings
      case MESSAGE_TYPE.SUBSCRIBE:
        first |= 0x02; // Qos = 1;
        for (var i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        remLength += this.requestedQos.length; // 1 byte for each topic's Qos
        // QoS on Subscribe only
        break;

      case MESSAGE_TYPE.UNSUBSCRIBE:
        first |= 0x02; // Qos = 1;
        for (var i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        break;

      case MESSAGE_TYPE.PUBREL:
        first |= 0x02; // Qos = 1;
        break;

      case MESSAGE_TYPE.PUBLISH:
        if (this.payloadMessage.duplicate) first |= 0x08;
        first = first |= this.payloadMessage.qos << 1;
        if (this.payloadMessage.retained) first |= 0x01;
        destinationNameLength = UTF8Length(this.payloadMessage.destinationName);
        remLength += destinationNameLength + 2;
        var payloadBytes = this.payloadMessage.payloadBytes;
        remLength += payloadBytes.byteLength;
        if (payloadBytes instanceof ArrayBuffer)
          payloadBytes = new Uint8Array(payloadBytes);
        else if (!(payloadBytes instanceof Uint8Array))
          payloadBytes = new Uint8Array(payloadBytes.buffer);
        break;

      case MESSAGE_TYPE.DISCONNECT:
        break;

      default:
    }

    // Now we can allocate a buffer for the message

    var mbi = encodeMBI(remLength); // Convert the length to MQTT MBI format
    var pos = mbi.length + 1; // Offset of start of variable header
    var buffer = new ArrayBuffer(remLength + pos);
    var byteStream = new Uint8Array(buffer); // view it as a sequence of bytes

    //Write the fixed header into the buffer
    byteStream[0] = first;
    byteStream.set(mbi, 1);

    // If this is a PUBLISH then the variable header starts with a topic
    if (this.type == MESSAGE_TYPE.PUBLISH)
      pos = writeString(
        this.payloadMessage.destinationName,
        destinationNameLength,
        byteStream,
        pos
      );
    // If this is a CONNECT then the variable header contains the protocol name/version, flags and keepalive time
    else if (this.type == MESSAGE_TYPE.CONNECT) {
      switch (this.mqttVersion) {
        case 3:
          byteStream.set(MqttProtoIdentifierv3, pos);
          pos += MqttProtoIdentifierv3.length;
          break;
        case 4:
          byteStream.set(MqttProtoIdentifierv4, pos);
          pos += MqttProtoIdentifierv4.length;
          break;
      }
      var connectFlags = 0;
      if (this.cleanSession) connectFlags = 0x02;
      if (this.willMessage != undefined) {
        connectFlags |= 0x04;
        connectFlags |= this.willMessage.qos << 3;
        if (this.willMessage.retained) {
          connectFlags |= 0x20;
        }
      }
      if (this.userName != undefined) connectFlags |= 0x80;
      if (this.password != undefined) connectFlags |= 0x40;
      byteStream[pos++] = connectFlags;
      pos = writeUint16(this.keepAliveInterval, byteStream, pos);
    }

    // Output the messageIdentifier - if there is one
    if (this.messageIdentifier != undefined)
      pos = writeUint16(this.messageIdentifier, byteStream, pos);

    switch (this.type) {
      case MESSAGE_TYPE.CONNECT:
        pos = writeString(
          this.clientId,
          UTF8Length(this.clientId),
          byteStream,
          pos
        );
        if (this.willMessage != undefined) {
          pos = writeString(
            this.willMessage.destinationName,
            UTF8Length(this.willMessage.destinationName),
            byteStream,
            pos
          );
          pos = writeUint16(
            willMessagePayloadBytes.byteLength,
            byteStream,
            pos
          );
          byteStream.set(willMessagePayloadBytes, pos);
          pos += willMessagePayloadBytes.byteLength;
        }
        if (this.userName != undefined)
          pos = writeString(
            this.userName,
            UTF8Length(this.userName),
            byteStream,
            pos
          );
        if (this.password != undefined)
          pos = writeString(
            this.password,
            UTF8Length(this.password),
            byteStream,
            pos
          );
        break;

      case MESSAGE_TYPE.PUBLISH:
        // PUBLISH has a text or binary payload, if text do not add a 2 byte length field, just the UTF characters.
        byteStream.set(payloadBytes, pos);

        break;

      //    	    case MESSAGE_TYPE.PUBREC:
      //    	    case MESSAGE_TYPE.PUBREL:
      //    	    case MESSAGE_TYPE.PUBCOMP:
      //    	    	break;

      case MESSAGE_TYPE.SUBSCRIBE:
        // SUBSCRIBE has a list of topic strings and request QoS
        for (var i = 0; i < this.topics.length; i++) {
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
          byteStream[pos++] = this.requestedQos[i];
        }
        break;

      case MESSAGE_TYPE.UNSUBSCRIBE:
        // UNSUBSCRIBE has a list of topic strings
        for (var i = 0; i < this.topics.length; i++)
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
        break;

      default:
      // Do nothing.
    }

    return buffer;
  };

  function decodeMessage(input, pos) {
    var startingPos = pos;
    var first = input[pos];
    var type = first >> 4;
    var messageInfo = (first &= 0x0f);
    pos += 1;

    // Decode the remaining length (MBI format)

    var digit;
    var remLength = 0;
    var multiplier = 1;
    do {
      if (pos == input.length) {
        return [null, startingPos];
      }
      digit = input[pos++];
      remLength += (digit & 0x7f) * multiplier;
      multiplier *= 128;
    } while ((digit & 0x80) != 0);

    var endPos = pos + remLength;
    if (endPos > input.length) {
      return [null, startingPos];
    }

    var wireMessage = new WireMessage(type);
    switch (type) {
      case MESSAGE_TYPE.CONNACK:
        var connectAcknowledgeFlags = input[pos++];
        if (connectAcknowledgeFlags & 0x01) wireMessage.sessionPresent = true;
        wireMessage.returnCode = input[pos++];
        break;

      case MESSAGE_TYPE.PUBLISH:
        var qos = (messageInfo >> 1) & 0x03;

        var len = readUint16(input, pos);
        pos += 2;
        var topicName = parseUTF8(input, pos, len);
        pos += len;
        // If QoS 1 or 2 there will be a messageIdentifier
        if (qos > 0) {
          wireMessage.messageIdentifier = readUint16(input, pos);
          pos += 2;
        }

        var message = new Paho.MQTT.Message(input.subarray(pos, endPos));
        if ((messageInfo & 0x01) == 0x01) message.retained = true;
        if ((messageInfo & 0x08) == 0x08) message.duplicate = true;
        message.qos = qos;
        message.destinationName = topicName;
        wireMessage.payloadMessage = message;
        break;

      case MESSAGE_TYPE.PUBACK:
      case MESSAGE_TYPE.PUBREC:
      case MESSAGE_TYPE.PUBREL:
      case MESSAGE_TYPE.PUBCOMP:
      case MESSAGE_TYPE.UNSUBACK:
        wireMessage.messageIdentifier = readUint16(input, pos);
        break;

      case MESSAGE_TYPE.SUBACK:
        wireMessage.messageIdentifier = readUint16(input, pos);
        pos += 2;
        wireMessage.returnCode = input.subarray(pos, endPos);
        break;

      default:
    }

    return [wireMessage, endPos];
  }

  function writeUint16(input, buffer, offset) {
    buffer[offset++] = input >> 8; //MSB
    buffer[offset++] = input % 256; //LSB
    return offset;
  }

  function writeString(input, utf8Length, buffer, offset) {
    offset = writeUint16(utf8Length, buffer, offset);
    stringToUTF8(input, buffer, offset);
    return offset + utf8Length;
  }

  function readUint16(buffer, offset) {
    return 256 * buffer[offset] + buffer[offset + 1];
  }

  /**
   * Encodes an MQTT Multi-Byte Integer
   * @private
   */
  function encodeMBI(number) {
    var output = new Array(1);
    var numBytes = 0;

    do {
      var digit = number % 128;
      number = number >> 7;
      if (number > 0) {
        digit |= 0x80;
      }
      output[numBytes++] = digit;
    } while (number > 0 && numBytes < 4);

    return output;
  }

  /**
   * Takes a String and calculates its length in bytes when encoded in UTF8.
   * @private
   */
  function UTF8Length(input) {
    var output = 0;
    for (var i = 0; i < input.length; i++) {
      var charCode = input.charCodeAt(i);
      if (charCode > 0x7ff) {
        // Surrogate pair means its a 4 byte character
        if (0xd800 <= charCode && charCode <= 0xdbff) {
          i++;
          output++;
        }
        output += 3;
      } else if (charCode > 0x7f) output += 2;
      else output++;
    }
    return output;
  }

  /**
   * Takes a String and writes it into an array as UTF8 encoded bytes.
   * @private
   */
  function stringToUTF8(input, output, start) {
    var pos = start;
    for (var i = 0; i < input.length; i++) {
      var charCode = input.charCodeAt(i);

      // Check for a surrogate pair.
      if (0xd800 <= charCode && charCode <= 0xdbff) {
        var lowCharCode = input.charCodeAt(++i);
        if (isNaN(lowCharCode)) {
          throw new Error(
            format(ERROR.MALFORMED_UNICODE, [charCode, lowCharCode])
          );
        }
        charCode =
          ((charCode - 0xd800) << 10) + (lowCharCode - 0xdc00) + 0x10000;
      }

      if (charCode <= 0x7f) {
        output[pos++] = charCode;
      } else if (charCode <= 0x7ff) {
        output[pos++] = ((charCode >> 6) & 0x1f) | 0xc0;
        output[pos++] = (charCode & 0x3f) | 0x80;
      } else if (charCode <= 0xffff) {
        output[pos++] = ((charCode >> 12) & 0x0f) | 0xe0;
        output[pos++] = ((charCode >> 6) & 0x3f) | 0x80;
        output[pos++] = (charCode & 0x3f) | 0x80;
      } else {
        output[pos++] = ((charCode >> 18) & 0x07) | 0xf0;
        output[pos++] = ((charCode >> 12) & 0x3f) | 0x80;
        output[pos++] = ((charCode >> 6) & 0x3f) | 0x80;
        output[pos++] = (charCode & 0x3f) | 0x80;
      }
    }
    return output;
  }

  function parseUTF8(input, offset, length) {
    var output = "";
    var utf16;
    var pos = offset;

    while (pos < offset + length) {
      var byte1 = input[pos++];
      if (byte1 < 128) utf16 = byte1;
      else {
        var byte2 = input[pos++] - 128;
        if (byte2 < 0)
          throw new Error(
            format(ERROR.MALFORMED_UTF, [
              byte1.toString(16),
              byte2.toString(16),
              "",
            ])
          );
        if (byte1 < 0xe0)
          // 2 byte character
          utf16 = 64 * (byte1 - 0xc0) + byte2;
        else {
          var byte3 = input[pos++] - 128;
          if (byte3 < 0)
            throw new Error(
              format(ERROR.MALFORMED_UTF, [
                byte1.toString(16),
                byte2.toString(16),
                byte3.toString(16),
              ])
            );
          if (byte1 < 0xf0)
            // 3 byte character
            utf16 = 4096 * (byte1 - 0xe0) + 64 * byte2 + byte3;
          else {
            var byte4 = input[pos++] - 128;
            if (byte4 < 0)
              throw new Error(
                format(ERROR.MALFORMED_UTF, [
                  byte1.toString(16),
                  byte2.toString(16),
                  byte3.toString(16),
                  byte4.toString(16),
                ])
              );
            if (byte1 < 0xf8)
              // 4 byte character
              utf16 =
                262144 * (byte1 - 0xf0) + 4096 * byte2 + 64 * byte3 + byte4;
            // longer encodings are not supported
            else
              throw new Error(
                format(ERROR.MALFORMED_UTF, [
                  byte1.toString(16),
                  byte2.toString(16),
                  byte3.toString(16),
                  byte4.toString(16),
                ])
              );
          }
        }
      }

      if (utf16 > 0xffff) {
        // 4 byte character - express as a surrogate pair
        utf16 -= 0x10000;
        output += String.fromCharCode(0xd800 + (utf16 >> 10)); // lead character
        utf16 = 0xdc00 + (utf16 & 0x3ff); // trail character
      }
      output += String.fromCharCode(utf16);
    }
    return output;
  }

  /**
   * Repeat keepalive requests, monitor responses.
   * @ignore
   */
  var Pinger = function (client, window, keepAliveInterval) {
    this._client = client;
    this._window = window;
    this._keepAliveInterval = keepAliveInterval * 1000;
    this.isReset = false;

    var pingReq = new WireMessage(MESSAGE_TYPE.PINGREQ).encode();

    var doTimeout = function (pinger) {
      return function () {
        return doPing.apply(pinger);
      };
    };

    /** @ignore */
    var doPing = function () {
      if (!this.isReset) {
        this._client._trace("Pinger.doPing", "Timed out");
        this._client._disconnected(
          ERROR.PING_TIMEOUT.code,
          format(ERROR.PING_TIMEOUT)
        );
      } else {
        this.isReset = false;
        this._client._trace("Pinger.doPing", "send PINGREQ");
        this._client.socket.send(pingReq);
        this.timeout = this._window.setTimeout(
          doTimeout(this),
          this._keepAliveInterval
        );
      }
    };

    this.reset = function () {
      this.isReset = true;
      this._window.clearTimeout(this.timeout);
      if (this._keepAliveInterval > 0)
        this.timeout = setTimeout(doTimeout(this), this._keepAliveInterval);
    };

    this.cancel = function () {
      this._window.clearTimeout(this.timeout);
    };
  };

  /**
   * Monitor request completion.
   * @ignore
   */
  var Timeout = function (client, window, timeoutSeconds, action, args) {
    this._window = window;
    if (!timeoutSeconds) timeoutSeconds = 30;

    var doTimeout = function (action, client, args) {
      return function () {
        return action.apply(client, args);
      };
    };
    this.timeout = setTimeout(
      doTimeout(action, client, args),
      timeoutSeconds * 1000
    );

    this.cancel = function () {
      this._window.clearTimeout(this.timeout);
    };
  };

  /*
   * Internal implementation of the Websockets MQTT V3.1 client.
   *
   * @name Paho.MQTT.ClientImpl @constructor
   * @param {String} host the DNS nameof the webSocket host.
   * @param {Number} port the port number for that host.
   * @param {String} clientId the MQ client identifier.
   */
  var ClientImpl = function (uri, host, port, path, clientId) {
    // Check dependencies are satisfied in this browser.
    if (!("WebSocket" in global && global["WebSocket"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["WebSocket"]));
    }
    if (!("localStorage" in global && global["localStorage"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["localStorage"]));
    }
    if (!("ArrayBuffer" in global && global["ArrayBuffer"] !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["ArrayBuffer"]));
    }
    this._trace("Paho.MQTT.Client", uri, host, port, path, clientId);

    this.host = host;
    this.port = port;
    this.path = path;
    this.uri = uri;
    this.clientId = clientId;

    // Local storagekeys are qualified with the following string.
    // The conditional inclusion of path in the key is for backward
    // compatibility to when the path was not configurable and assumed to
    // be /mqtt
    this._localKey =
      host +
      ":" +
      port +
      (path != "/mqtt" ? ":" + path : "") +
      ":" +
      clientId +
      ":";

    // Create private instance-only message queue
    // Internal queue of messages to be sent, in sending order.
    this._msg_queue = [];

    // Messages we have sent and are expecting a response for, indexed by their respective message ids.
    this._sentMessages = {};

    // Messages we have received and acknowleged and are expecting a confirm message for
    // indexed by their respective message ids.
    this._receivedMessages = {};

    // Internal list of callbacks to be executed when messages
    // have been successfully sent over web socket, e.g. disconnect
    // when it doesn't have to wait for ACK, just message is dispatched.
    this._notify_msg_sent = {};

    // Unique identifier for SEND messages, incrementing
    // counter as messages are sent.
    this._message_identifier = 1;

    // Used to determine the transmission sequence of stored sent messages.
    this._sequence = 0;

    // Load the local state, if any, from the saved version, only restore state relevant to this client.
    for (var key in localStorage)
      if (
        key.indexOf("Sent:" + this._localKey) == 0 ||
        key.indexOf("Received:" + this._localKey) == 0
      )
        this.restore(key);
  };

  // Messaging Client public instance members.
  ClientImpl.prototype.host;
  ClientImpl.prototype.port;
  ClientImpl.prototype.path;
  ClientImpl.prototype.uri;
  ClientImpl.prototype.clientId;

  // Messaging Client private instance members.
  ClientImpl.prototype.socket;
  /* true once we have received an acknowledgement to a CONNECT packet. */
  ClientImpl.prototype.connected = false;
  /* The largest message identifier allowed, may not be larger than 2**16 but
   * if set smaller reduces the maximum number of outbound messages allowed.
   */
  ClientImpl.prototype.maxMessageIdentifier = 65536;
  ClientImpl.prototype.connectOptions;
  ClientImpl.prototype.hostIndex;
  ClientImpl.prototype.onConnectionLost;
  ClientImpl.prototype.onMessageDelivered;
  ClientImpl.prototype.onMessageArrived;
  ClientImpl.prototype.traceFunction;
  ClientImpl.prototype._msg_queue = null;
  ClientImpl.prototype._connectTimeout;
  /* The sendPinger monitors how long we allow before we send data to prove to the server that we are alive. */
  ClientImpl.prototype.sendPinger = null;
  /* The receivePinger monitors how long we allow before we require evidence that the server is alive. */
  ClientImpl.prototype.receivePinger = null;

  ClientImpl.prototype.receiveBuffer = null;

  ClientImpl.prototype._traceBuffer = null;
  ClientImpl.prototype._MAX_TRACE_ENTRIES = 100;

  ClientImpl.prototype.connect = function (connectOptions) {
    var connectOptionsMasked = this._traceMask(connectOptions, "password");
    this._trace(
      "Client.connect",
      connectOptionsMasked,
      this.socket,
      this.connected
    );

    if (this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
    if (this.socket)
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));

    this.connectOptions = connectOptions;

    if (connectOptions.uris) {
      this.hostIndex = 0;
      this._doConnect(connectOptions.uris[0]);
    } else {
      this._doConnect(this.uri);
    }
  };

  ClientImpl.prototype.subscribe = function (filter, subscribeOptions) {
    this._trace("Client.subscribe", filter, subscribeOptions);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    var wireMessage = new WireMessage(MESSAGE_TYPE.SUBSCRIBE);
    wireMessage.topics = [filter];
    if (subscribeOptions.qos != undefined)
      wireMessage.requestedQos = [subscribeOptions.qos];
    else wireMessage.requestedQos = [0];

    if (subscribeOptions.onSuccess) {
      wireMessage.onSuccess = function (grantedQos) {
        subscribeOptions.onSuccess({
          invocationContext: subscribeOptions.invocationContext,
          grantedQos: grantedQos,
        });
      };
    }

    if (subscribeOptions.onFailure) {
      wireMessage.onFailure = function (errorCode) {
        subscribeOptions.onFailure({
          invocationContext: subscribeOptions.invocationContext,
          errorCode: errorCode,
        });
      };
    }

    if (subscribeOptions.timeout) {
      wireMessage.timeOut = new Timeout(
        this,
        window,
        subscribeOptions.timeout,
        subscribeOptions.onFailure,
        [
          {
            invocationContext: subscribeOptions.invocationContext,
            errorCode: ERROR.SUBSCRIBE_TIMEOUT.code,
            errorMessage: format(ERROR.SUBSCRIBE_TIMEOUT),
          },
        ]
      );
    }

    // All subscriptions return a SUBACK.
    this._requires_ack(wireMessage);
    this._schedule_message(wireMessage);
  };

  /** @ignore */
  ClientImpl.prototype.unsubscribe = function (filter, unsubscribeOptions) {
    this._trace("Client.unsubscribe", filter, unsubscribeOptions);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    var wireMessage = new WireMessage(MESSAGE_TYPE.UNSUBSCRIBE);
    wireMessage.topics = [filter];

    if (unsubscribeOptions.onSuccess) {
      wireMessage.callback = function () {
        unsubscribeOptions.onSuccess({
          invocationContext: unsubscribeOptions.invocationContext,
        });
      };
    }
    if (unsubscribeOptions.timeout) {
      wireMessage.timeOut = new Timeout(
        this,
        window,
        unsubscribeOptions.timeout,
        unsubscribeOptions.onFailure,
        [
          {
            invocationContext: unsubscribeOptions.invocationContext,
            errorCode: ERROR.UNSUBSCRIBE_TIMEOUT.code,
            errorMessage: format(ERROR.UNSUBSCRIBE_TIMEOUT),
          },
        ]
      );
    }

    // All unsubscribes return a SUBACK.
    this._requires_ack(wireMessage);
    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.send = function (message) {
    this._trace("Client.send", message);

    if (!this.connected)
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));

    wireMessage = new WireMessage(MESSAGE_TYPE.PUBLISH);
    wireMessage.payloadMessage = message;

    if (message.qos > 0) this._requires_ack(wireMessage);
    else if (this.onMessageDelivered)
      this._notify_msg_sent[wireMessage] = this.onMessageDelivered(
        wireMessage.payloadMessage
      );
    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.disconnect = function () {
    this._trace("Client.disconnect");

    if (!this.socket)
      throw new Error(
        format(ERROR.INVALID_STATE, ["not connecting or connected"])
      );

    wireMessage = new WireMessage(MESSAGE_TYPE.DISCONNECT);

    // Run the disconnected call back as soon as the message has been sent,
    // in case of a failure later on in the disconnect processing.
    // as a consequence, the _disconected call back may be run several times.
    this._notify_msg_sent[wireMessage] = scope(this._disconnected, this);

    this._schedule_message(wireMessage);
  };

  ClientImpl.prototype.getTraceLog = function () {
    if (this._traceBuffer !== null) {
      this._trace("Client.getTraceLog", new Date());
      this._trace(
        "Client.getTraceLog in flight messages",
        this._sentMessages.length
      );
      for (var key in this._sentMessages)
        this._trace("_sentMessages ", key, this._sentMessages[key]);
      for (var key in this._receivedMessages)
        this._trace("_receivedMessages ", key, this._receivedMessages[key]);

      return this._traceBuffer;
    }
  };

  ClientImpl.prototype.startTrace = function () {
    if (this._traceBuffer === null) {
      this._traceBuffer = [];
    }
    this._trace("Client.startTrace", new Date(), version);
  };

  ClientImpl.prototype.stopTrace = function () {
    delete this._traceBuffer;
  };

  ClientImpl.prototype._doConnect = function (wsurl) {
    // When the socket is open, this client will send the CONNECT WireMessage using the saved parameters.
    if (this.connectOptions.useSSL) {
      var uriParts = wsurl.split(":");
      uriParts[0] = "wss";
      wsurl = uriParts.join(":");
    }
    this.connected = false;
    if (this.connectOptions.mqttVersion < 4) {
      this.socket = new WebSocket(wsurl, ["mqttv3.1"]);
    } else {
      this.socket = new WebSocket(wsurl, ["mqtt"]);
    }
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = scope(this._on_socket_open, this);
    this.socket.onmessage = scope(this._on_socket_message, this);
    this.socket.onerror = scope(this._on_socket_error, this);
    this.socket.onclose = scope(this._on_socket_close, this);

    this.sendPinger = new Pinger(
      this,
      window,
      this.connectOptions.keepAliveInterval
    );
    this.receivePinger = new Pinger(
      this,
      window,
      this.connectOptions.keepAliveInterval
    );

    this._connectTimeout = new Timeout(
      this,
      window,
      this.connectOptions.timeout,
      this._disconnected,
      [ERROR.CONNECT_TIMEOUT.code, format(ERROR.CONNECT_TIMEOUT)]
    );
  };

  // Schedule a new message to be sent over the WebSockets
  // connection. CONNECT messages cause WebSocket connection
  // to be started. All other messages are queued internally
  // until this has happened. When WS connection starts, process
  // all outstanding messages.
  ClientImpl.prototype._schedule_message = function (message) {
    this._msg_queue.push(message);
    // Process outstanding messages in the queue if we have an  open socket, and have received CONNACK.
    if (this.connected) {
      this._process_queue();
    }
  };

  ClientImpl.prototype.store = function (prefix, wireMessage) {
    var storedMessage = {
      type: wireMessage.type,
      messageIdentifier: wireMessage.messageIdentifier,
      version: 1,
    };

    switch (wireMessage.type) {
      case MESSAGE_TYPE.PUBLISH:
        if (wireMessage.pubRecReceived) storedMessage.pubRecReceived = true;

        // Convert the payload to a hex string.
        storedMessage.payloadMessage = {};
        var hex = "";
        var messageBytes = wireMessage.payloadMessage.payloadBytes;
        for (var i = 0; i < messageBytes.length; i++) {
          if (messageBytes[i] <= 0xf)
            hex = hex + "0" + messageBytes[i].toString(16);
          else hex = hex + messageBytes[i].toString(16);
        }
        storedMessage.payloadMessage.payloadHex = hex;

        storedMessage.payloadMessage.qos = wireMessage.payloadMessage.qos;
        storedMessage.payloadMessage.destinationName =
          wireMessage.payloadMessage.destinationName;
        if (wireMessage.payloadMessage.duplicate)
          storedMessage.payloadMessage.duplicate = true;
        if (wireMessage.payloadMessage.retained)
          storedMessage.payloadMessage.retained = true;

        // Add a sequence number to sent messages.
        if (prefix.indexOf("Sent:") == 0) {
          if (wireMessage.sequence === undefined)
            wireMessage.sequence = ++this._sequence;
          storedMessage.sequence = wireMessage.sequence;
        }
        break;

      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [key, storedMessage]));
    }
    localStorage.setItem(
      prefix + this._localKey + wireMessage.messageIdentifier,
      JSON.stringify(storedMessage)
    );
  };

  ClientImpl.prototype.restore = function (key) {
    var value = localStorage.getItem(key);
    var storedMessage = JSON.parse(value);

    var wireMessage = new WireMessage(storedMessage.type, storedMessage);

    switch (storedMessage.type) {
      case MESSAGE_TYPE.PUBLISH:
        // Replace the payload message with a Message object.
        var hex = storedMessage.payloadMessage.payloadHex;
        var buffer = new ArrayBuffer(hex.length / 2);
        var byteStream = new Uint8Array(buffer);
        var i = 0;
        while (hex.length >= 2) {
          var x = parseInt(hex.substring(0, 2), 16);
          hex = hex.substring(2, hex.length);
          byteStream[i++] = x;
        }
        var payloadMessage = new Paho.MQTT.Message(byteStream);

        payloadMessage.qos = storedMessage.payloadMessage.qos;
        payloadMessage.destinationName =
          storedMessage.payloadMessage.destinationName;
        if (storedMessage.payloadMessage.duplicate)
          payloadMessage.duplicate = true;
        if (storedMessage.payloadMessage.retained)
          payloadMessage.retained = true;
        wireMessage.payloadMessage = payloadMessage;

        break;

      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [key, value]));
    }

    if (key.indexOf("Sent:" + this._localKey) == 0) {
      wireMessage.payloadMessage.duplicate = true;
      this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    } else if (key.indexOf("Received:" + this._localKey) == 0) {
      this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
    }
  };

  ClientImpl.prototype._process_queue = function () {
    var message = null;
    // Process messages in order they were added
    var fifo = this._msg_queue.reverse();

    // Send all queued messages down socket connection
    while ((message = fifo.pop())) {
      this._socket_send(message);
      // Notify listeners that message was successfully sent
      if (this._notify_msg_sent[message]) {
        this._notify_msg_sent[message]();
        delete this._notify_msg_sent[message];
      }
    }
  };

  /**
   * Expect an ACK response for this message. Add message to the set of in progress
   * messages and set an unused identifier in this message.
   * @ignore
   */
  ClientImpl.prototype._requires_ack = function (wireMessage) {
    var messageCount = Object.keys(this._sentMessages).length;
    if (messageCount > this.maxMessageIdentifier)
      throw Error("Too many messages:" + messageCount);

    while (this._sentMessages[this._message_identifier] !== undefined) {
      this._message_identifier++;
    }
    wireMessage.messageIdentifier = this._message_identifier;
    this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    if (wireMessage.type === MESSAGE_TYPE.PUBLISH) {
      this.store("Sent:", wireMessage);
    }
    if (this._message_identifier === this.maxMessageIdentifier) {
      this._message_identifier = 1;
    }
  };

  /**
   * Called when the underlying websocket has been opened.
   * @ignore
   */
  ClientImpl.prototype._on_socket_open = function () {
    // Create the CONNECT message object.
    var wireMessage = new WireMessage(
      MESSAGE_TYPE.CONNECT,
      this.connectOptions
    );
    wireMessage.clientId = this.clientId;
    this._socket_send(wireMessage);
  };

  /**
   * Called when the underlying websocket has received a complete packet.
   * @ignore
   */
  ClientImpl.prototype._on_socket_message = function (event) {
    this._trace("Client._on_socket_message", event.data);
    // Reset the receive ping timer, we now have evidence the server is alive.
    this.receivePinger.reset();
    var messages = this._deframeMessages(event.data);
    for (var i = 0; i < messages.length; i += 1) {
      this._handleMessage(messages[i]);
    }
  };

  ClientImpl.prototype._deframeMessages = function (data) {
    var byteArray = new Uint8Array(data);
    if (this.receiveBuffer) {
      var newData = new Uint8Array(
        this.receiveBuffer.length + byteArray.length
      );
      newData.set(this.receiveBuffer);
      newData.set(byteArray, this.receiveBuffer.length);
      byteArray = newData;
      delete this.receiveBuffer;
    }
    try {
      var offset = 0;
      var messages = [];
      while (offset < byteArray.length) {
        var result = decodeMessage(byteArray, offset);
        var wireMessage = result[0];
        offset = result[1];
        if (wireMessage !== null) {
          messages.push(wireMessage);
        } else {
          break;
        }
      }
      if (offset < byteArray.length) {
        this.receiveBuffer = byteArray.subarray(offset);
      }
    } catch (error) {
      this._disconnected(
        ERROR.INTERNAL_ERROR.code,
        format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()])
      );
      return;
    }
    return messages;
  };

  ClientImpl.prototype._handleMessage = function (wireMessage) {
    this._trace("Client._handleMessage", wireMessage);

    try {
      switch (wireMessage.type) {
        case MESSAGE_TYPE.CONNACK:
          this._connectTimeout.cancel();

          // If we have started using clean session then clear up the local state.
          if (this.connectOptions.cleanSession) {
            for (var key in this._sentMessages) {
              var sentMessage = this._sentMessages[key];
              localStorage.removeItem(
                "Sent:" + this._localKey + sentMessage.messageIdentifier
              );
            }
            this._sentMessages = {};

            for (var key in this._receivedMessages) {
              var receivedMessage = this._receivedMessages[key];
              localStorage.removeItem(
                "Received:" + this._localKey + receivedMessage.messageIdentifier
              );
            }
            this._receivedMessages = {};
          }
          // Client connected and ready for business.
          if (wireMessage.returnCode === 0) {
            this.connected = true;
            // Jump to the end of the list of uris and stop looking for a good host.
            if (this.connectOptions.uris)
              this.hostIndex = this.connectOptions.uris.length;
          } else {
            this._disconnected(
              ERROR.CONNACK_RETURNCODE.code,
              format(ERROR.CONNACK_RETURNCODE, [
                wireMessage.returnCode,
                CONNACK_RC[wireMessage.returnCode],
              ])
            );
            break;
          }

          // Resend messages.
          var sequencedMessages = new Array();
          for (var msgId in this._sentMessages) {
            if (this._sentMessages.hasOwnProperty(msgId))
              sequencedMessages.push(this._sentMessages[msgId]);
          }

          // Sort sentMessages into the original sent order.
          var sequencedMessages = sequencedMessages.sort(function (a, b) {
            return a.sequence - b.sequence;
          });
          for (var i = 0, len = sequencedMessages.length; i < len; i++) {
            var sentMessage = sequencedMessages[i];
            if (
              sentMessage.type == MESSAGE_TYPE.PUBLISH &&
              sentMessage.pubRecReceived
            ) {
              var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
                messageIdentifier: sentMessage.messageIdentifier,
              });
              this._schedule_message(pubRelMessage);
            } else {
              this._schedule_message(sentMessage);
            }
          }

          // Execute the connectOptions.onSuccess callback if there is one.
          if (this.connectOptions.onSuccess) {
            this.connectOptions.onSuccess({
              invocationContext: this.connectOptions.invocationContext,
            });
          }

          // Process all queued messages now that the connection is established.
          this._process_queue();
          break;

        case MESSAGE_TYPE.PUBLISH:
          this._receivePublish(wireMessage);
          break;

        case MESSAGE_TYPE.PUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBACK after we have restarted receivedMessage will not exist.
          if (sentMessage) {
            delete this._sentMessages[wireMessage.messageIdentifier];
            localStorage.removeItem(
              "Sent:" + this._localKey + wireMessage.messageIdentifier
            );
            if (this.onMessageDelivered)
              this.onMessageDelivered(sentMessage.payloadMessage);
          }
          break;

        case MESSAGE_TYPE.PUBREC:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBREC after we have restarted receivedMessage will not exist.
          if (sentMessage) {
            sentMessage.pubRecReceived = true;
            var pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
              messageIdentifier: wireMessage.messageIdentifier,
            });
            this.store("Sent:", sentMessage);
            this._schedule_message(pubRelMessage);
          }
          break;

        case MESSAGE_TYPE.PUBREL:
          var receivedMessage =
            this._receivedMessages[wireMessage.messageIdentifier];
          localStorage.removeItem(
            "Received:" + this._localKey + wireMessage.messageIdentifier
          );
          // If this is a re flow of a PUBREL after we have restarted receivedMessage will not exist.
          if (receivedMessage) {
            this._receiveMessage(receivedMessage);
            delete this._receivedMessages[wireMessage.messageIdentifier];
          }
          // Always flow PubComp, we may have previously flowed PubComp but the server lost it and restarted.
          var pubCompMessage = new WireMessage(MESSAGE_TYPE.PUBCOMP, {
            messageIdentifier: wireMessage.messageIdentifier,
          });
          this._schedule_message(pubCompMessage);
          break;

        case MESSAGE_TYPE.PUBCOMP:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          delete this._sentMessages[wireMessage.messageIdentifier];
          localStorage.removeItem(
            "Sent:" + this._localKey + wireMessage.messageIdentifier
          );
          if (this.onMessageDelivered)
            this.onMessageDelivered(sentMessage.payloadMessage);
          break;

        case MESSAGE_TYPE.SUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          if (sentMessage) {
            if (sentMessage.timeOut) sentMessage.timeOut.cancel();
            // This will need to be fixed when we add multiple topic support
            if (wireMessage.returnCode[0] === 0x80) {
              if (sentMessage.onFailure) {
                sentMessage.onFailure(wireMessage.returnCode);
              }
            } else if (sentMessage.onSuccess) {
              sentMessage.onSuccess(wireMessage.returnCode);
            }
            delete this._sentMessages[wireMessage.messageIdentifier];
          }
          break;

        case MESSAGE_TYPE.UNSUBACK:
          var sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          if (sentMessage) {
            if (sentMessage.timeOut) sentMessage.timeOut.cancel();
            if (sentMessage.callback) {
              sentMessage.callback();
            }
            delete this._sentMessages[wireMessage.messageIdentifier];
          }

          break;

        case MESSAGE_TYPE.PINGRESP:
          /* The sendPinger or receivePinger may have sent a ping, the receivePinger has already been reset. */
          this.sendPinger.reset();
          break;

        case MESSAGE_TYPE.DISCONNECT:
          // Clients do not expect to receive disconnect packets.
          this._disconnected(
            ERROR.INVALID_MQTT_MESSAGE_TYPE.code,
            format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type])
          );
          break;

        default:
          this._disconnected(
            ERROR.INVALID_MQTT_MESSAGE_TYPE.code,
            format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type])
          );
      }
    } catch (error) {
      this._disconnected(
        ERROR.INTERNAL_ERROR.code,
        format(ERROR.INTERNAL_ERROR, [error.message, error.stack.toString()])
      );
      return;
    }
  };

  /** @ignore */
  ClientImpl.prototype._on_socket_error = function (error) {
    this._disconnected(
      ERROR.SOCKET_ERROR.code,
      format(ERROR.SOCKET_ERROR, [error.data])
    );
  };

  /** @ignore */
  ClientImpl.prototype._on_socket_close = function () {
    this._disconnected(ERROR.SOCKET_CLOSE.code, format(ERROR.SOCKET_CLOSE));
  };

  /** @ignore */
  ClientImpl.prototype._socket_send = function (wireMessage) {
    if (wireMessage.type == 1) {
      var wireMessageMasked = this._traceMask(wireMessage, "password");
      this._trace("Client._socket_send", wireMessageMasked);
    } else this._trace("Client._socket_send", wireMessage);

    this.socket.send(wireMessage.encode());
    /* We have proved to the server we are alive. */
    this.sendPinger.reset();
  };

  /** @ignore */
  ClientImpl.prototype._receivePublish = function (wireMessage) {
    switch (wireMessage.payloadMessage.qos) {
      case "undefined":
      case 0:
        this._receiveMessage(wireMessage);
        break;

      case 1:
        var pubAckMessage = new WireMessage(MESSAGE_TYPE.PUBACK, {
          messageIdentifier: wireMessage.messageIdentifier,
        });
        this._schedule_message(pubAckMessage);
        this._receiveMessage(wireMessage);
        break;

      case 2:
        this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
        this.store("Received:", wireMessage);
        var pubRecMessage = new WireMessage(MESSAGE_TYPE.PUBREC, {
          messageIdentifier: wireMessage.messageIdentifier,
        });
        this._schedule_message(pubRecMessage);

        break;

      default:
        throw Error("Invaild qos=" + wireMmessage.payloadMessage.qos);
    }
  };

  /** @ignore */
  ClientImpl.prototype._receiveMessage = function (wireMessage) {
    if (this.onMessageArrived) {
      this.onMessageArrived(wireMessage.payloadMessage);
    }
  };

  /**
   * Client has disconnected either at its own request or because the server
   * or network disconnected it. Remove all non-durable state.
   * @param {errorCode} [number] the error number.
   * @param {errorText} [string] the error text.
   * @ignore
   */
  ClientImpl.prototype._disconnected = function (errorCode, errorText) {
    this._trace("Client._disconnected", errorCode, errorText);

    this.sendPinger.cancel();
    this.receivePinger.cancel();
    if (this._connectTimeout) this._connectTimeout.cancel();
    // Clear message buffers.
    this._msg_queue = [];
    this._notify_msg_sent = {};

    if (this.socket) {
      // Cancel all socket callbacks so that they cannot be driven again by this socket.
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      if (this.socket.readyState === 1) this.socket.close();
      delete this.socket;
    }

    if (
      this.connectOptions.uris &&
      this.hostIndex < this.connectOptions.uris.length - 1
    ) {
      // Try the next host.
      this.hostIndex++;
      this._doConnect(this.connectOptions.uris[this.hostIndex]);
    } else {
      if (errorCode === undefined) {
        errorCode = ERROR.OK.code;
        errorText = format(ERROR.OK);
      }

      // Run any application callbacks last as they may attempt to reconnect and hence create a new socket.
      if (this.connected) {
        this.connected = false;
        // Execute the connectionLostCallback if there is one, and we were connected.
        if (this.onConnectionLost)
          this.onConnectionLost({
            errorCode: errorCode,
            errorMessage: errorText,
          });
      } else {
        // Otherwise we never had a connection, so indicate that the connect has failed.
        if (
          this.connectOptions.mqttVersion === 4 &&
          this.connectOptions.mqttVersionExplicit === false
        ) {
          this._trace("Failed to connect V4, dropping back to V3");
          this.connectOptions.mqttVersion = 3;
          if (this.connectOptions.uris) {
            this.hostIndex = 0;
            this._doConnect(this.connectOptions.uris[0]);
          } else {
            this._doConnect(this.uri);
          }
        } else if (this.connectOptions.onFailure) {
          this.connectOptions.onFailure({
            invocationContext: this.connectOptions.invocationContext,
            errorCode: errorCode,
            errorMessage: errorText,
          });
        }
      }
    }
  };

  /** @ignore */
  ClientImpl.prototype._trace = function () {
    // Pass trace message back to client's callback function
    if (this.traceFunction) {
      for (var i in arguments) {
        if (typeof arguments[i] !== "undefined")
          arguments[i] = JSON.stringify(arguments[i]);
      }
      var record = Array.prototype.slice.call(arguments).join("");
      this.traceFunction({ severity: "Debug", message: record });
    }

    //buffer style trace
    if (this._traceBuffer !== null) {
      for (var i = 0, max = arguments.length; i < max; i++) {
        if (this._traceBuffer.length == this._MAX_TRACE_ENTRIES) {
          this._traceBuffer.shift();
        }
        if (i === 0) this._traceBuffer.push(arguments[i]);
        else if (typeof arguments[i] === "undefined")
          this._traceBuffer.push(arguments[i]);
        else this._traceBuffer.push("  " + JSON.stringify(arguments[i]));
      }
    }
  };

  /** @ignore */
  ClientImpl.prototype._traceMask = function (traceObject, masked) {
    var traceObjectMasked = {};
    for (var attr in traceObject) {
      if (traceObject.hasOwnProperty(attr)) {
        if (attr == masked) traceObjectMasked[attr] = "******";
        else traceObjectMasked[attr] = traceObject[attr];
      }
    }
    return traceObjectMasked;
  };

  // ------------------------------------------------------------------------
  // Public Programming interface.
  // ------------------------------------------------------------------------

  /**
   * The JavaScript application communicates to the server using a {@link Paho.MQTT.Client} object.
   * <p>
   * Most applications will create just one Client object and then call its connect() method,
   * however applications can create more than one Client object if they wish.
   * In this case the combination of host, port and clientId attributes must be different for each Client object.
   * <p>
   * The send, subscribe and unsubscribe methods are implemented as asynchronous JavaScript methods
   * (even though the underlying protocol exchange might be synchronous in nature).
   * This means they signal their completion by calling back to the application,
   * via Success or Failure callback functions provided by the application on the method in question.
   * Such callbacks are called at most once per method invocation and do not persist beyond the lifetime
   * of the script that made the invocation.
   * <p>
   * In contrast there are some callback functions, most notably <i>onMessageArrived</i>,
   * that are defined on the {@link Paho.MQTT.Client} object.
   * These may get called multiple times, and aren't directly related to specific method invocations made by the client.
   *
   * @name Paho.MQTT.Client
   *
   * @constructor
   *
   * @param {string} host - the address of the messaging server, as a fully qualified WebSocket URI, as a DNS name or dotted decimal IP address.
   * @param {number} port - the port number to connect to - only required if host is not a URI
   * @param {string} path - the path on the host to connect to - only used if host is not a URI. Default: '/mqtt'.
   * @param {string} clientId - the Messaging client identifier, between 1 and 23 characters in length.
   *
   * @property {string} host - <i>read only</i> the server's DNS hostname or dotted decimal IP address.
   * @property {number} port - <i>read only</i> the server's port.
   * @property {string} path - <i>read only</i> the server's path.
   * @property {string} clientId - <i>read only</i> used when connecting to the server.
   * @property {function} onConnectionLost - called when a connection has been lost.
   *                            after a connect() method has succeeded.
   *                            Establish the call back used when a connection has been lost. The connection may be
   *                            lost because the client initiates a disconnect or because the server or network
   *                            cause the client to be disconnected. The disconnect call back may be called without
   *                            the connectionComplete call back being invoked if, for example the client fails to
   *                            connect.
   *                            A single response object parameter is passed to the onConnectionLost callback containing the following fields:
   *                            <ol>
   *                            <li>errorCode
   *                            <li>errorMessage
   *                            </ol>
   * @property {function} onMessageDelivered called when a message has been delivered.
   *                            All processing that this Client will ever do has been completed. So, for example,
   *                            in the case of a Qos=2 message sent by this client, the PubComp flow has been received from the server
   *                            and the message has been removed from persistent storage before this callback is invoked.
   *                            Parameters passed to the onMessageDelivered callback are:
   *                            <ol>
   *                            <li>{@link Paho.MQTT.Message} that was delivered.
   *                            </ol>
   * @property {function} onMessageArrived called when a message has arrived in this Paho.MQTT.client.
   *                            Parameters passed to the onMessageArrived callback are:
   *                            <ol>
   *                            <li>{@link Paho.MQTT.Message} that has arrived.
   *                            </ol>
   */
  var Client = function (host, port, path, clientId) {
    var uri;

    if (typeof host !== "string")
      throw new Error(format(ERROR.INVALID_TYPE, [typeof host, "host"]));

    if (arguments.length == 2) {
      // host: must be full ws:// uri
      // port: clientId
      clientId = port;
      uri = host;
      var match = uri.match(
        /^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/
      );
      if (match) {
        host = match[4] || match[2];
        port = parseInt(match[7]);
        path = match[8];
      } else {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [host, "host"]));
      }
    } else {
      if (arguments.length == 3) {
        clientId = path;
        path = "/mqtt";
      }
      if (typeof port !== "number" || port < 0)
        throw new Error(format(ERROR.INVALID_TYPE, [typeof port, "port"]));
      if (typeof path !== "string")
        throw new Error(format(ERROR.INVALID_TYPE, [typeof path, "path"]));

      var ipv6AddSBracket =
        host.indexOf(":") != -1 &&
        host.slice(0, 1) != "[" &&
        host.slice(-1) != "]";
      uri =
        "ws://" +
        (ipv6AddSBracket ? "[" + host + "]" : host) +
        ":" +
        port +
        path;
    }

    var clientIdLength = 0;
    for (var i = 0; i < clientId.length; i++) {
      var charCode = clientId.charCodeAt(i);
      if (0xd800 <= charCode && charCode <= 0xdbff) {
        i++; // Surrogate pair.
      }
      clientIdLength++;
    }
    if (typeof clientId !== "string" || clientIdLength > 65535)
      throw new Error(format(ERROR.INVALID_ARGUMENT, [clientId, "clientId"]));

    var client = new ClientImpl(uri, host, port, path, clientId);
    this._getHost = function () {
      return host;
    };
    this._setHost = function () {
      throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
    };

    this._getPort = function () {
      return port;
    };
    this._setPort = function () {
      throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
    };

    this._getPath = function () {
      return path;
    };
    this._setPath = function () {
      throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
    };

    this._getURI = function () {
      return uri;
    };
    this._setURI = function () {
      throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
    };

    this._getClientId = function () {
      return client.clientId;
    };
    this._setClientId = function () {
      throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
    };

    this._getOnConnectionLost = function () {
      return client.onConnectionLost;
    };
    this._setOnConnectionLost = function (newOnConnectionLost) {
      if (typeof newOnConnectionLost === "function")
        client.onConnectionLost = newOnConnectionLost;
      else
        throw new Error(
          format(ERROR.INVALID_TYPE, [
            typeof newOnConnectionLost,
            "onConnectionLost",
          ])
        );
    };

    this._getOnMessageDelivered = function () {
      return client.onMessageDelivered;
    };
    this._setOnMessageDelivered = function (newOnMessageDelivered) {
      if (typeof newOnMessageDelivered === "function")
        client.onMessageDelivered = newOnMessageDelivered;
      else
        throw new Error(
          format(ERROR.INVALID_TYPE, [
            typeof newOnMessageDelivered,
            "onMessageDelivered",
          ])
        );
    };

    this._getOnMessageArrived = function () {
      return client.onMessageArrived;
    };
    this._setOnMessageArrived = function (newOnMessageArrived) {
      if (typeof newOnMessageArrived === "function")
        client.onMessageArrived = newOnMessageArrived;
      else
        throw new Error(
          format(ERROR.INVALID_TYPE, [
            typeof newOnMessageArrived,
            "onMessageArrived",
          ])
        );
    };

    this._getTrace = function () {
      return client.traceFunction;
    };
    this._setTrace = function (trace) {
      if (typeof trace === "function") {
        client.traceFunction = trace;
      } else {
        throw new Error(format(ERROR.INVALID_TYPE, [typeof trace, "onTrace"]));
      }
    };

    /**
     * Connect this Messaging client to its server.
     *
     * @name Paho.MQTT.Client#connect
     * @function
     * @param {Object} connectOptions - attributes used with the connection.
     * @param {number} connectOptions.timeout - If the connect has not succeeded within this
     *                    number of seconds, it is deemed to have failed.
     *                    The default is 30 seconds.
     * @param {string} connectOptions.userName - Authentication username for this connection.
     * @param {string} connectOptions.password - Authentication password for this connection.
     * @param {Paho.MQTT.Message} connectOptions.willMessage - sent by the server when the client
     *                    disconnects abnormally.
     * @param {Number} connectOptions.keepAliveInterval - the server disconnects this client if
     *                    there is no activity for this number of seconds.
     *                    The default value of 60 seconds is assumed if not set.
     * @param {boolean} connectOptions.cleanSession - if true(default) the client and server
     *                    persistent state is deleted on successful connect.
     * @param {boolean} connectOptions.useSSL - if present and true, use an SSL Websocket connection.
     * @param {object} connectOptions.invocationContext - passed to the onSuccess callback or onFailure callback.
     * @param {function} connectOptions.onSuccess - called when the connect acknowledgement
     *                    has been received from the server.
     * A single response object parameter is passed to the onSuccess callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onSuccess method in the connectOptions.
     * </ol>
     * @config {function} [onFailure] called when the connect request has failed or timed out.
     * A single response object parameter is passed to the onFailure callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onFailure method in the connectOptions.
     * <li>errorCode a number indicating the nature of the error.
     * <li>errorMessage text describing the error.
     * </ol>
     * @config {Array} [hosts] If present this contains either a set of hostnames or fully qualified
     * WebSocket URIs (ws://example.com:1883/mqtt), that are tried in order in place
     * of the host and port paramater on the construtor. The hosts are tried one at at time in order until
     * one of then succeeds.
     * @config {Array} [ports] If present the set of ports matching the hosts. If hosts contains URIs, this property
     * is not used.
     * @throws {InvalidState} if the client is not in disconnected state. The client must have received connectionLost
     * or disconnected before calling connect for a second or subsequent time.
     */
    this.connect = function (connectOptions) {
      connectOptions = connectOptions || {};
      validate(connectOptions, {
        timeout: "number",
        userName: "string",
        password: "string",
        willMessage: "object",
        keepAliveInterval: "number",
        cleanSession: "boolean",
        useSSL: "boolean",
        invocationContext: "object",
        onSuccess: "function",
        onFailure: "function",
        hosts: "object",
        ports: "object",
        mqttVersion: "number",
      });

      // If no keep alive interval is set, assume 60 seconds.
      if (connectOptions.keepAliveInterval === undefined)
        connectOptions.keepAliveInterval = 60;

      if (connectOptions.mqttVersion > 4 || connectOptions.mqttVersion < 3) {
        throw new Error(
          format(ERROR.INVALID_ARGUMENT, [
            connectOptions.mqttVersion,
            "connectOptions.mqttVersion",
          ])
        );
      }

      if (connectOptions.mqttVersion === undefined) {
        connectOptions.mqttVersionExplicit = false;
        connectOptions.mqttVersion = 4;
      } else {
        connectOptions.mqttVersionExplicit = true;
      }

      //Check that if password is set, so is username
      if (
        connectOptions.password === undefined &&
        connectOptions.userName !== undefined
      )
        throw new Error(
          format(ERROR.INVALID_ARGUMENT, [
            connectOptions.password,
            "connectOptions.password",
          ])
        );

      if (connectOptions.willMessage) {
        if (!(connectOptions.willMessage instanceof Message))
          throw new Error(
            format(ERROR.INVALID_TYPE, [
              connectOptions.willMessage,
              "connectOptions.willMessage",
            ])
          );
        // The will message must have a payload that can be represented as a string.
        // Cause the willMessage to throw an exception if this is not the case.
        connectOptions.willMessage.stringPayload;

        if (typeof connectOptions.willMessage.destinationName === "undefined")
          throw new Error(
            format(ERROR.INVALID_TYPE, [
              typeof connectOptions.willMessage.destinationName,
              "connectOptions.willMessage.destinationName",
            ])
          );
      }
      if (typeof connectOptions.cleanSession === "undefined")
        connectOptions.cleanSession = true;
      if (connectOptions.hosts) {
        if (!(connectOptions.hosts instanceof Array))
          throw new Error(
            format(ERROR.INVALID_ARGUMENT, [
              connectOptions.hosts,
              "connectOptions.hosts",
            ])
          );
        if (connectOptions.hosts.length < 1)
          throw new Error(
            format(ERROR.INVALID_ARGUMENT, [
              connectOptions.hosts,
              "connectOptions.hosts",
            ])
          );

        var usingURIs = false;
        for (var i = 0; i < connectOptions.hosts.length; i++) {
          if (typeof connectOptions.hosts[i] !== "string")
            throw new Error(
              format(ERROR.INVALID_TYPE, [
                typeof connectOptions.hosts[i],
                "connectOptions.hosts[" + i + "]",
              ])
            );
          if (
            /^(wss?):\/\/((\[(.+)\])|([^\/]+?))(:(\d+))?(\/.*)$/.test(
              connectOptions.hosts[i]
            )
          ) {
            if (i == 0) {
              usingURIs = true;
            } else if (!usingURIs) {
              throw new Error(
                format(ERROR.INVALID_ARGUMENT, [
                  connectOptions.hosts[i],
                  "connectOptions.hosts[" + i + "]",
                ])
              );
            }
          } else if (usingURIs) {
            throw new Error(
              format(ERROR.INVALID_ARGUMENT, [
                connectOptions.hosts[i],
                "connectOptions.hosts[" + i + "]",
              ])
            );
          }
        }

        if (!usingURIs) {
          if (!connectOptions.ports)
            throw new Error(
              format(ERROR.INVALID_ARGUMENT, [
                connectOptions.ports,
                "connectOptions.ports",
              ])
            );
          if (!(connectOptions.ports instanceof Array))
            throw new Error(
              format(ERROR.INVALID_ARGUMENT, [
                connectOptions.ports,
                "connectOptions.ports",
              ])
            );
          if (connectOptions.hosts.length != connectOptions.ports.length)
            throw new Error(
              format(ERROR.INVALID_ARGUMENT, [
                connectOptions.ports,
                "connectOptions.ports",
              ])
            );

          connectOptions.uris = [];

          for (var i = 0; i < connectOptions.hosts.length; i++) {
            if (
              typeof connectOptions.ports[i] !== "number" ||
              connectOptions.ports[i] < 0
            )
              throw new Error(
                format(ERROR.INVALID_TYPE, [
                  typeof connectOptions.ports[i],
                  "connectOptions.ports[" + i + "]",
                ])
              );
            var host = connectOptions.hosts[i];
            var port = connectOptions.ports[i];

            var ipv6 = host.indexOf(":") != -1;
            uri =
              "ws://" + (ipv6 ? "[" + host + "]" : host) + ":" + port + path;
            connectOptions.uris.push(uri);
          }
        } else {
          connectOptions.uris = connectOptions.hosts;
        }
      }

      client.connect(connectOptions);
    };

    /**
     * Subscribe for messages, request receipt of a copy of messages sent to the destinations described by the filter.
     *
     * @name Paho.MQTT.Client#subscribe
     * @function
     * @param {string} filter describing the destinations to receive messages from.
     * <br>
     * @param {object} subscribeOptions - used to control the subscription
     *
     * @param {number} subscribeOptions.qos - the maiximum qos of any publications sent
     *                                  as a result of making this subscription.
     * @param {object} subscribeOptions.invocationContext - passed to the onSuccess callback
     *                                  or onFailure callback.
     * @param {function} subscribeOptions.onSuccess - called when the subscribe acknowledgement
     *                                  has been received from the server.
     *                                  A single response object parameter is passed to the onSuccess callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext if set in the subscribeOptions.
     *                                  </ol>
     * @param {function} subscribeOptions.onFailure - called when the subscribe request has failed or timed out.
     *                                  A single response object parameter is passed to the onFailure callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext - if set in the subscribeOptions.
     *                                  <li>errorCode - a number indicating the nature of the error.
     *                                  <li>errorMessage - text describing the error.
     *                                  </ol>
     * @param {number} subscribeOptions.timeout - which, if present, determines the number of
     *                                  seconds after which the onFailure calback is called.
     *                                  The presence of a timeout does not prevent the onSuccess
     *                                  callback from being called when the subscribe completes.
     * @throws {InvalidState} if the client is not in connected state.
     */
    this.subscribe = function (filter, subscribeOptions) {
      if (typeof filter !== "string")
        throw new Error("Invalid argument:" + filter);
      subscribeOptions = subscribeOptions || {};
      validate(subscribeOptions, {
        qos: "number",
        invocationContext: "object",
        onSuccess: "function",
        onFailure: "function",
        timeout: "number",
      });
      if (subscribeOptions.timeout && !subscribeOptions.onFailure)
        throw new Error(
          "subscribeOptions.timeout specified with no onFailure callback."
        );
      if (
        typeof subscribeOptions.qos !== "undefined" &&
        !(
          subscribeOptions.qos === 0 ||
          subscribeOptions.qos === 1 ||
          subscribeOptions.qos === 2
        )
      )
        throw new Error(
          format(ERROR.INVALID_ARGUMENT, [
            subscribeOptions.qos,
            "subscribeOptions.qos",
          ])
        );
      client.subscribe(filter, subscribeOptions);
    };

    /**
		 * Unsubscribe for messages, stop receiving messages sent to destinations described by the filter.
		 * 
		 * @name Paho.MQTT.Client#unsubscribe
		 * @function
		 * @param {string} filter - describing the destinations to receive messages from.
		 * @param {object} unsubscribeOptions - used to control the subscription
		 * @param {object} unsubscribeOptions.invocationContext - passed to the onSuccess callback 
		                                      or onFailure callback.
		 * @param {function} unsubscribeOptions.onSuccess - called when the unsubscribe acknowledgement has been received from the server.
		 *                                    A single response object parameter is passed to the 
		 *                                    onSuccess callback containing the following fields:
		 *                                    <ol>
		 *                                    <li>invocationContext - if set in the unsubscribeOptions.     
		 *                                    </ol>
		 * @param {function} unsubscribeOptions.onFailure called when the unsubscribe request has failed or timed out.
		 *                                    A single response object parameter is passed to the onFailure callback containing the following fields:
		 *                                    <ol>
		 *                                    <li>invocationContext - if set in the unsubscribeOptions.       
		 *                                    <li>errorCode - a number indicating the nature of the error.
		 *                                    <li>errorMessage - text describing the error.      
		 *                                    </ol>
		 * @param {number} unsubscribeOptions.timeout - which, if present, determines the number of seconds
		 *                                    after which the onFailure callback is called. The presence of
		 *                                    a timeout does not prevent the onSuccess callback from being
		 *                                    called when the unsubscribe completes
		 * @throws {InvalidState} if the client is not in connected state.
		 */
    this.unsubscribe = function (filter, unsubscribeOptions) {
      if (typeof filter !== "string")
        throw new Error("Invalid argument:" + filter);
      unsubscribeOptions = unsubscribeOptions || {};
      validate(unsubscribeOptions, {
        invocationContext: "object",
        onSuccess: "function",
        onFailure: "function",
        timeout: "number",
      });
      if (unsubscribeOptions.timeout && !unsubscribeOptions.onFailure)
        throw new Error(
          "unsubscribeOptions.timeout specified with no onFailure callback."
        );
      client.unsubscribe(filter, unsubscribeOptions);
    };

    /**
     * Send a message to the consumers of the destination in the Message.
     *
     * @name Paho.MQTT.Client#send
     * @function
     * @param {string|Paho.MQTT.Message} topic - <b>mandatory</b> The name of the destination to which the message is to be sent.
     * 					   - If it is the only parameter, used as Paho.MQTT.Message object.
     * @param {String|ArrayBuffer} payload - The message data to be sent.
     * @param {number} qos The Quality of Service used to deliver the message.
     * 		<dl>
     * 			<dt>0 Best effort (default).
     *     			<dt>1 At least once.
     *     			<dt>2 Exactly once.
     * 		</dl>
     * @param {Boolean} retained If true, the message is to be retained by the server and delivered
     *                     to both current and future subscriptions.
     *                     If false the server only delivers the message to current subscribers, this is the default for new Messages.
     *                     A received message has the retained boolean set to true if the message was published
     *                     with the retained boolean set to true
     *                     and the subscrption was made after the message has been published.
     * @throws {InvalidState} if the client is not connected.
     */
    this.send = function (topic, payload, qos, retained) {
      var message;

      if (arguments.length == 0) {
        throw new Error("Invalid argument." + "length");
      } else if (arguments.length == 1) {
        if (!(topic instanceof Message) && typeof topic !== "string")
          throw new Error("Invalid argument:" + typeof topic);

        message = topic;
        if (typeof message.destinationName === "undefined")
          throw new Error(
            format(ERROR.INVALID_ARGUMENT, [
              message.destinationName,
              "Message.destinationName",
            ])
          );
        client.send(message);
      } else {
        //parameter checking in Message object
        message = new Message(payload);
        message.destinationName = topic;
        if (arguments.length >= 3) message.qos = qos;
        if (arguments.length >= 4) message.retained = retained;
        client.send(message);
      }
    };

    /**
     * Normal disconnect of this Messaging client from its server.
     *
     * @name Paho.MQTT.Client#disconnect
     * @function
     * @throws {InvalidState} if the client is already disconnected.
     */
    this.disconnect = function () {
      client.disconnect();
    };

    /**
     * Get the contents of the trace log.
     *
     * @name Paho.MQTT.Client#getTraceLog
     * @function
     * @return {Object[]} tracebuffer containing the time ordered trace records.
     */
    this.getTraceLog = function () {
      return client.getTraceLog();
    };

    /**
     * Start tracing.
     *
     * @name Paho.MQTT.Client#startTrace
     * @function
     */
    this.startTrace = function () {
      client.startTrace();
    };

    /**
     * Stop tracing.
     *
     * @name Paho.MQTT.Client#stopTrace
     * @function
     */
    this.stopTrace = function () {
      client.stopTrace();
    };

    this.isConnected = function () {
      return client.connected;
    };
  };

  Client.prototype = {
    get host() {
      return this._getHost();
    },
    set host(newHost) {
      this._setHost(newHost);
    },

    get port() {
      return this._getPort();
    },
    set port(newPort) {
      this._setPort(newPort);
    },

    get path() {
      return this._getPath();
    },
    set path(newPath) {
      this._setPath(newPath);
    },

    get clientId() {
      return this._getClientId();
    },
    set clientId(newClientId) {
      this._setClientId(newClientId);
    },

    get onConnectionLost() {
      return this._getOnConnectionLost();
    },
    set onConnectionLost(newOnConnectionLost) {
      this._setOnConnectionLost(newOnConnectionLost);
    },

    get onMessageDelivered() {
      return this._getOnMessageDelivered();
    },
    set onMessageDelivered(newOnMessageDelivered) {
      this._setOnMessageDelivered(newOnMessageDelivered);
    },

    get onMessageArrived() {
      return this._getOnMessageArrived();
    },
    set onMessageArrived(newOnMessageArrived) {
      this._setOnMessageArrived(newOnMessageArrived);
    },

    get trace() {
      return this._getTrace();
    },
    set trace(newTraceFunction) {
      this._setTrace(newTraceFunction);
    },
  };

  /**
   * An application message, sent or received.
   * <p>
   * All attributes may be null, which implies the default values.
   *
   * @name Paho.MQTT.Message
   * @constructor
   * @param {String|ArrayBuffer} payload The message data to be sent.
   * <p>
   * @property {string} payloadString <i>read only</i> The payload as a string if the payload consists of valid UTF-8 characters.
   * @property {ArrayBuffer} payloadBytes <i>read only</i> The payload as an ArrayBuffer.
   * <p>
   * @property {string} destinationName <b>mandatory</b> The name of the destination to which the message is to be sent
   *                    (for messages about to be sent) or the name of the destination from which the message has been received.
   *                    (for messages received by the onMessage function).
   * <p>
   * @property {number} qos The Quality of Service used to deliver the message.
   * <dl>
   *     <dt>0 Best effort (default).
   *     <dt>1 At least once.
   *     <dt>2 Exactly once.
   * </dl>
   * <p>
   * @property {Boolean} retained If true, the message is to be retained by the server and delivered
   *                     to both current and future subscriptions.
   *                     If false the server only delivers the message to current subscribers, this is the default for new Messages.
   *                     A received message has the retained boolean set to true if the message was published
   *                     with the retained boolean set to true
   *                     and the subscrption was made after the message has been published.
   * <p>
   * @property {Boolean} duplicate <i>read only</i> If true, this message might be a duplicate of one which has already been received.
   *                     This is only set on messages received from the server.
   *
   */
  var Message = function (newPayload) {
    var payload;
    if (
      typeof newPayload === "string" ||
      newPayload instanceof ArrayBuffer ||
      newPayload instanceof Int8Array ||
      newPayload instanceof Uint8Array ||
      newPayload instanceof Int16Array ||
      newPayload instanceof Uint16Array ||
      newPayload instanceof Int32Array ||
      newPayload instanceof Uint32Array ||
      newPayload instanceof Float32Array ||
      newPayload instanceof Float64Array
    ) {
      payload = newPayload;
    } else {
      throw format(ERROR.INVALID_ARGUMENT, [newPayload, "newPayload"]);
    }

    this._getPayloadString = function () {
      if (typeof payload === "string") return payload;
      else return parseUTF8(payload, 0, payload.length);
    };

    this._getPayloadBytes = function () {
      if (typeof payload === "string") {
        var buffer = new ArrayBuffer(UTF8Length(payload));
        var byteStream = new Uint8Array(buffer);
        stringToUTF8(payload, byteStream, 0);

        return byteStream;
      } else {
        return payload;
      }
    };

    var destinationName = undefined;
    this._getDestinationName = function () {
      return destinationName;
    };
    this._setDestinationName = function (newDestinationName) {
      if (typeof newDestinationName === "string")
        destinationName = newDestinationName;
      else
        throw new Error(
          format(ERROR.INVALID_ARGUMENT, [
            newDestinationName,
            "newDestinationName",
          ])
        );
    };

    var qos = 0;
    this._getQos = function () {
      return qos;
    };
    this._setQos = function (newQos) {
      if (newQos === 0 || newQos === 1 || newQos === 2) qos = newQos;
      else throw new Error("Invalid argument:" + newQos);
    };

    var retained = false;
    this._getRetained = function () {
      return retained;
    };
    this._setRetained = function (newRetained) {
      if (typeof newRetained === "boolean") retained = newRetained;
      else
        throw new Error(
          format(ERROR.INVALID_ARGUMENT, [newRetained, "newRetained"])
        );
    };

    var duplicate = false;
    this._getDuplicate = function () {
      return duplicate;
    };
    this._setDuplicate = function (newDuplicate) {
      duplicate = newDuplicate;
    };
  };

  Message.prototype = {
    get payloadString() {
      return this._getPayloadString();
    },
    get payloadBytes() {
      return this._getPayloadBytes();
    },

    get destinationName() {
      return this._getDestinationName();
    },
    set destinationName(newDestinationName) {
      this._setDestinationName(newDestinationName);
    },

    get qos() {
      return this._getQos();
    },
    set qos(newQos) {
      this._setQos(newQos);
    },

    get retained() {
      return this._getRetained();
    },
    set retained(newRetained) {
      this._setRetained(newRetained);
    },

    get duplicate() {
      return this._getDuplicate();
    },
    set duplicate(newDuplicate) {
      this._setDuplicate(newDuplicate);
    },
  };

  // Module contents.
  return {
    Client: Client,
    Message: Message,
  };
})(window);

// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __extends =
  this.__extends ||
  function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() {
      this.constructor = d;
    }
    __.prototype = b.prototype;
    d.prototype = new __();
  };
var MutationObserverCtor;
if (typeof WebKitMutationObserver !== "undefined")
  MutationObserverCtor = WebKitMutationObserver;
else MutationObserverCtor = MutationObserver;
if (MutationObserverCtor === undefined) {
  console.error("DOM Mutation Observers are required.");
  console.error(
    "https://developer.mozilla.org/en-US/docs/DOM/MutationObserver"
  );
  throw Error("DOM Mutation Observers are required");
}
var NodeMap = (function () {
  function NodeMap() {
    this.nodes = [];
    this.values = [];
  }
  NodeMap.prototype.isIndex = function (s) {
    return +s === s >>> 0;
  };
  NodeMap.prototype.nodeId = function (node) {
    var id = node[NodeMap.ID_PROP];
    if (!id) id = node[NodeMap.ID_PROP] = NodeMap.nextId_++;
    return id;
  };
  NodeMap.prototype.set = function (node, value) {
    var id = this.nodeId(node);
    this.nodes[id] = node;
    this.values[id] = value;
  };
  NodeMap.prototype.get = function (node) {
    var id = this.nodeId(node);
    return this.values[id];
  };
  NodeMap.prototype.has = function (node) {
    return this.nodeId(node) in this.nodes;
  };
  NodeMap.prototype.delete = function (node) {
    var id = this.nodeId(node);
    delete this.nodes[id];
    this.values[id] = undefined;
  };
  NodeMap.prototype.keys = function () {
    var nodes = [];
    for (var id in this.nodes) {
      if (!this.isIndex(id)) continue;
      nodes.push(this.nodes[id]);
    }
    return nodes;
  };
  NodeMap.ID_PROP = "__mutation_summary_node_map_id__";
  NodeMap.nextId_ = 1;
  return NodeMap;
})();
/**
 *  var reachableMatchableProduct = [
 *  //  STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED
 *    [ STAYED_OUT,  STAYED_OUT,  STAYED_OUT,  STAYED_OUT ], // STAYED_OUT
 *    [ STAYED_OUT,  ENTERED,     ENTERED,     STAYED_OUT ], // ENTERED
 *    [ STAYED_OUT,  ENTERED,     STAYED_IN,   EXITED     ], // STAYED_IN
 *    [ STAYED_OUT,  STAYED_OUT,  EXITED,      EXITED     ]  // EXITED
 *  ];
 */
var Movement;
(function (Movement) {
  Movement[(Movement["STAYED_OUT"] = 0)] = "STAYED_OUT";
  Movement[(Movement["ENTERED"] = 1)] = "ENTERED";
  Movement[(Movement["STAYED_IN"] = 2)] = "STAYED_IN";
  Movement[(Movement["REPARENTED"] = 3)] = "REPARENTED";
  Movement[(Movement["REORDERED"] = 4)] = "REORDERED";
  Movement[(Movement["EXITED"] = 5)] = "EXITED";
})(Movement || (Movement = {}));
function enteredOrExited(changeType) {
  return changeType === Movement.ENTERED || changeType === Movement.EXITED;
}
var NodeChange = (function () {
  function NodeChange(
    node,
    childList,
    attributes,
    characterData,
    oldParentNode,
    added,
    attributeOldValues,
    characterDataOldValue
  ) {
    if (childList === void 0) {
      childList = false;
    }
    if (attributes === void 0) {
      attributes = false;
    }
    if (characterData === void 0) {
      characterData = false;
    }
    if (oldParentNode === void 0) {
      oldParentNode = null;
    }
    if (added === void 0) {
      added = false;
    }
    if (attributeOldValues === void 0) {
      attributeOldValues = null;
    }
    if (characterDataOldValue === void 0) {
      characterDataOldValue = null;
    }
    this.node = node;
    this.childList = childList;
    this.attributes = attributes;
    this.characterData = characterData;
    this.oldParentNode = oldParentNode;
    this.added = added;
    this.attributeOldValues = attributeOldValues;
    this.characterDataOldValue = characterDataOldValue;
    this.isCaseInsensitive =
      this.node.nodeType === Node.ELEMENT_NODE &&
      this.node instanceof HTMLElement &&
      this.node.ownerDocument instanceof HTMLDocument;
  }
  NodeChange.prototype.getAttributeOldValue = function (name) {
    if (!this.attributeOldValues) return undefined;
    if (this.isCaseInsensitive) name = name.toLowerCase();
    return this.attributeOldValues[name];
  };
  NodeChange.prototype.getAttributeNamesMutated = function () {
    var names = [];
    if (!this.attributeOldValues) return names;
    for (var name in this.attributeOldValues) {
      names.push(name);
    }
    return names;
  };
  NodeChange.prototype.attributeMutated = function (name, oldValue) {
    this.attributes = true;
    this.attributeOldValues = this.attributeOldValues || {};
    if (name in this.attributeOldValues) return;
    this.attributeOldValues[name] = oldValue;
  };
  NodeChange.prototype.characterDataMutated = function (oldValue) {
    if (this.characterData) return;
    this.characterData = true;
    this.characterDataOldValue = oldValue;
  };
  // Note: is it possible to receive a removal followed by a removal. This
  // can occur if the removed node is added to an non-observed node, that
  // node is added to the observed area, and then the node removed from
  // it.
  NodeChange.prototype.removedFromParent = function (parent) {
    this.childList = true;
    if (this.added || this.oldParentNode) this.added = false;
    else this.oldParentNode = parent;
  };
  NodeChange.prototype.insertedIntoParent = function () {
    this.childList = true;
    this.added = true;
  };
  // An node's oldParent is
  //   -its present parent, if its parentNode was not changed.
  //   -null if the first thing that happened to it was an add.
  //   -the node it was removed from if the first thing that happened to it
  //      was a remove.
  NodeChange.prototype.getOldParent = function () {
    if (this.childList) {
      if (this.oldParentNode) return this.oldParentNode;
      if (this.added) return null;
    }
    return this.node.parentNode;
  };
  return NodeChange;
})();
var ChildListChange = (function () {
  function ChildListChange() {
    this.added = new NodeMap();
    this.removed = new NodeMap();
    this.maybeMoved = new NodeMap();
    this.oldPrevious = new NodeMap();
    this.moved = undefined;
  }
  return ChildListChange;
})();
var TreeChanges = (function (_super) {
  __extends(TreeChanges, _super);
  function TreeChanges(rootNode, mutations) {
    _super.call(this);
    this.rootNode = rootNode;
    this.reachableCache = undefined;
    this.wasReachableCache = undefined;
    this.anyParentsChanged = false;
    this.anyAttributesChanged = false;
    this.anyCharacterDataChanged = false;
    for (var m = 0; m < mutations.length; m++) {
      var mutation = mutations[m];
      switch (mutation.type) {
        case "childList":
          this.anyParentsChanged = true;
          for (var i = 0; i < mutation.removedNodes.length; i++) {
            var node = mutation.removedNodes[i];
            this.getChange(node).removedFromParent(mutation.target);
          }
          for (var i = 0; i < mutation.addedNodes.length; i++) {
            var node = mutation.addedNodes[i];
            this.getChange(node).insertedIntoParent();
          }
          break;
        case "attributes":
          this.anyAttributesChanged = true;
          var change = this.getChange(mutation.target);
          change.attributeMutated(mutation.attributeName, mutation.oldValue);
          break;
        case "characterData":
          this.anyCharacterDataChanged = true;
          var change = this.getChange(mutation.target);
          change.characterDataMutated(mutation.oldValue);
          break;
      }
    }
  }
  TreeChanges.prototype.getChange = function (node) {
    var change = this.get(node);
    if (!change) {
      change = new NodeChange(node);
      this.set(node, change);
    }
    return change;
  };
  TreeChanges.prototype.getOldParent = function (node) {
    var change = this.get(node);
    return change ? change.getOldParent() : node.parentNode;
  };
  TreeChanges.prototype.getIsReachable = function (node) {
    if (node === this.rootNode) return true;
    if (!node) return false;
    this.reachableCache = this.reachableCache || new NodeMap();
    var isReachable = this.reachableCache.get(node);
    if (isReachable === undefined) {
      isReachable = this.getIsReachable(node.parentNode);
      this.reachableCache.set(node, isReachable);
    }
    return isReachable;
  };
  // A node wasReachable if its oldParent wasReachable.
  TreeChanges.prototype.getWasReachable = function (node) {
    if (node === this.rootNode) return true;
    if (!node) return false;
    this.wasReachableCache = this.wasReachableCache || new NodeMap();
    var wasReachable = this.wasReachableCache.get(node);
    if (wasReachable === undefined) {
      wasReachable = this.getWasReachable(this.getOldParent(node));
      this.wasReachableCache.set(node, wasReachable);
    }
    return wasReachable;
  };
  TreeChanges.prototype.reachabilityChange = function (node) {
    if (this.getIsReachable(node)) {
      return this.getWasReachable(node) ? Movement.STAYED_IN : Movement.ENTERED;
    }
    return this.getWasReachable(node) ? Movement.EXITED : Movement.STAYED_OUT;
  };
  return TreeChanges;
})(NodeMap);
var MutationProjection = (function () {
  // TOOD(any)
  function MutationProjection(
    rootNode,
    mutations,
    selectors,
    calcReordered,
    calcOldPreviousSibling
  ) {
    this.rootNode = rootNode;
    this.mutations = mutations;
    this.selectors = selectors;
    this.calcReordered = calcReordered;
    this.calcOldPreviousSibling = calcOldPreviousSibling;
    this.treeChanges = new TreeChanges(rootNode, mutations);
    this.entered = [];
    this.exited = [];
    this.stayedIn = new NodeMap();
    this.visited = new NodeMap();
    this.childListChangeMap = undefined;
    this.characterDataOnly = undefined;
    this.matchCache = undefined;
    this.processMutations();
  }
  MutationProjection.prototype.processMutations = function () {
    if (
      !this.treeChanges.anyParentsChanged &&
      !this.treeChanges.anyAttributesChanged
    )
      return;
    var changedNodes = this.treeChanges.keys();
    for (var i = 0; i < changedNodes.length; i++) {
      this.visitNode(changedNodes[i], undefined);
    }
  };
  MutationProjection.prototype.visitNode = function (node, parentReachable) {
    if (this.visited.has(node)) return;
    this.visited.set(node, true);
    var change = this.treeChanges.get(node);
    var reachable = parentReachable;
    // node inherits its parent's reachability change unless
    // its parentNode was mutated.
    if ((change && change.childList) || reachable == undefined)
      reachable = this.treeChanges.reachabilityChange(node);
    if (reachable === Movement.STAYED_OUT) return;
    // Cache match results for sub-patterns.
    this.matchabilityChange(node);
    if (reachable === Movement.ENTERED) {
      this.entered.push(node);
    } else if (reachable === Movement.EXITED) {
      this.exited.push(node);
      this.ensureHasOldPreviousSiblingIfNeeded(node);
    } else if (reachable === Movement.STAYED_IN) {
      var movement = Movement.STAYED_IN;
      if (change && change.childList) {
        if (change.oldParentNode !== node.parentNode) {
          movement = Movement.REPARENTED;
          this.ensureHasOldPreviousSiblingIfNeeded(node);
        } else if (this.calcReordered && this.wasReordered(node)) {
          movement = Movement.REORDERED;
        }
      }
      this.stayedIn.set(node, movement);
    }
    if (reachable === Movement.STAYED_IN) return;
    // reachable === ENTERED || reachable === EXITED.
    for (var child = node.firstChild; child; child = child.nextSibling) {
      this.visitNode(child, reachable);
    }
  };
  MutationProjection.prototype.ensureHasOldPreviousSiblingIfNeeded = function (
    node
  ) {
    if (!this.calcOldPreviousSibling) return;
    this.processChildlistChanges();
    var parentNode = node.parentNode;
    var nodeChange = this.treeChanges.get(node);
    if (nodeChange && nodeChange.oldParentNode)
      parentNode = nodeChange.oldParentNode;
    var change = this.childListChangeMap.get(parentNode);
    if (!change) {
      change = new ChildListChange();
      this.childListChangeMap.set(parentNode, change);
    }
    if (!change.oldPrevious.has(node)) {
      change.oldPrevious.set(node, node.previousSibling);
    }
  };
  MutationProjection.prototype.getChanged = function (
    summary,
    selectors,
    characterDataOnly
  ) {
    this.selectors = selectors;
    this.characterDataOnly = characterDataOnly;
    for (var i = 0; i < this.entered.length; i++) {
      var node = this.entered[i];
      var matchable = this.matchabilityChange(node);
      if (matchable === Movement.ENTERED || matchable === Movement.STAYED_IN)
        summary.added.push(node);
    }
    var stayedInNodes = this.stayedIn.keys();
    for (var i = 0; i < stayedInNodes.length; i++) {
      var node = stayedInNodes[i];
      var matchable = this.matchabilityChange(node);
      if (matchable === Movement.ENTERED) {
        summary.added.push(node);
      } else if (matchable === Movement.EXITED) {
        summary.removed.push(node);
      } else if (
        matchable === Movement.STAYED_IN &&
        (summary.reparented || summary.reordered)
      ) {
        var movement = this.stayedIn.get(node);
        if (summary.reparented && movement === Movement.REPARENTED)
          summary.reparented.push(node);
        else if (summary.reordered && movement === Movement.REORDERED)
          summary.reordered.push(node);
      }
    }
    for (var i = 0; i < this.exited.length; i++) {
      var node = this.exited[i];
      var matchable = this.matchabilityChange(node);
      if (matchable === Movement.EXITED || matchable === Movement.STAYED_IN)
        summary.removed.push(node);
    }
  };
  MutationProjection.prototype.getOldParentNode = function (node) {
    var change = this.treeChanges.get(node);
    if (change && change.childList)
      return change.oldParentNode ? change.oldParentNode : null;
    var reachabilityChange = this.treeChanges.reachabilityChange(node);
    if (
      reachabilityChange === Movement.STAYED_OUT ||
      reachabilityChange === Movement.ENTERED
    )
      throw Error("getOldParentNode requested on invalid node.");
    return node.parentNode;
  };
  MutationProjection.prototype.getOldPreviousSibling = function (node) {
    var parentNode = node.parentNode;
    var nodeChange = this.treeChanges.get(node);
    if (nodeChange && nodeChange.oldParentNode)
      parentNode = nodeChange.oldParentNode;
    var change = this.childListChangeMap.get(parentNode);
    if (!change)
      throw Error("getOldPreviousSibling requested on invalid node.");
    return change.oldPrevious.get(node);
  };
  MutationProjection.prototype.getOldAttribute = function (element, attrName) {
    var change = this.treeChanges.get(element);
    if (!change || !change.attributes)
      throw Error("getOldAttribute requested on invalid node.");
    var value = change.getAttributeOldValue(attrName);
    if (value === undefined)
      throw Error("getOldAttribute requested for unchanged attribute name.");
    return value;
  };
  MutationProjection.prototype.attributeChangedNodes = function (
    includeAttributes
  ) {
    if (!this.treeChanges.anyAttributesChanged) return {}; // No attributes mutations occurred.
    var attributeFilter;
    var caseInsensitiveFilter;
    if (includeAttributes) {
      attributeFilter = {};
      caseInsensitiveFilter = {};
      for (var i = 0; i < includeAttributes.length; i++) {
        var attrName = includeAttributes[i];
        attributeFilter[attrName] = true;
        caseInsensitiveFilter[attrName.toLowerCase()] = attrName;
      }
    }
    var result = {};
    var nodes = this.treeChanges.keys();
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var change = this.treeChanges.get(node);
      if (!change.attributes) continue;
      if (
        Movement.STAYED_IN !== this.treeChanges.reachabilityChange(node) ||
        Movement.STAYED_IN !== this.matchabilityChange(node)
      ) {
        continue;
      }
      var element = node;
      var changedAttrNames = change.getAttributeNamesMutated();
      for (var j = 0; j < changedAttrNames.length; j++) {
        var attrName = changedAttrNames[j];
        if (
          attributeFilter &&
          !attributeFilter[attrName] &&
          !(change.isCaseInsensitive && caseInsensitiveFilter[attrName])
        ) {
          continue;
        }
        var oldValue = change.getAttributeOldValue(attrName);
        if (oldValue === element.getAttribute(attrName)) continue;
        if (caseInsensitiveFilter && change.isCaseInsensitive)
          attrName = caseInsensitiveFilter[attrName];
        result[attrName] = result[attrName] || [];
        result[attrName].push(element);
      }
    }
    return result;
  };
  MutationProjection.prototype.getOldCharacterData = function (node) {
    var change = this.treeChanges.get(node);
    if (!change || !change.characterData)
      throw Error("getOldCharacterData requested on invalid node.");
    return change.characterDataOldValue;
  };
  MutationProjection.prototype.getCharacterDataChanged = function () {
    if (!this.treeChanges.anyCharacterDataChanged) return []; // No characterData mutations occurred.
    var nodes = this.treeChanges.keys();
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var target = nodes[i];
      if (Movement.STAYED_IN !== this.treeChanges.reachabilityChange(target))
        continue;
      var change = this.treeChanges.get(target);
      if (
        !change.characterData ||
        target.textContent == change.characterDataOldValue
      )
        continue;
      result.push(target);
    }
    return result;
  };
  MutationProjection.prototype.computeMatchabilityChange = function (
    selector,
    el
  ) {
    if (!this.matchCache) this.matchCache = [];
    if (!this.matchCache[selector.uid])
      this.matchCache[selector.uid] = new NodeMap();
    var cache = this.matchCache[selector.uid];
    var result = cache.get(el);
    if (result === undefined) {
      result = selector.matchabilityChange(el, this.treeChanges.get(el));
      cache.set(el, result);
    }
    return result;
  };
  MutationProjection.prototype.matchabilityChange = function (node) {
    var _this = this;
    // TODO(rafaelw): Include PI, CDATA?
    // Only include text nodes.
    if (this.characterDataOnly) {
      switch (node.nodeType) {
        case Node.COMMENT_NODE:
        case Node.TEXT_NODE:
          return Movement.STAYED_IN;
        default:
          return Movement.STAYED_OUT;
      }
    }
    // No element filter. Include all nodes.
    if (!this.selectors) return Movement.STAYED_IN;
    // Element filter. Exclude non-elements.
    if (node.nodeType !== Node.ELEMENT_NODE) return Movement.STAYED_OUT;
    var el = node;
    var matchChanges = this.selectors.map(function (selector) {
      return _this.computeMatchabilityChange(selector, el);
    });
    var accum = Movement.STAYED_OUT;
    var i = 0;
    while (accum !== Movement.STAYED_IN && i < matchChanges.length) {
      switch (matchChanges[i]) {
        case Movement.STAYED_IN:
          accum = Movement.STAYED_IN;
          break;
        case Movement.ENTERED:
          if (accum === Movement.EXITED) accum = Movement.STAYED_IN;
          else accum = Movement.ENTERED;
          break;
        case Movement.EXITED:
          if (accum === Movement.ENTERED) accum = Movement.STAYED_IN;
          else accum = Movement.EXITED;
          break;
      }
      i++;
    }
    return accum;
  };
  MutationProjection.prototype.getChildlistChange = function (el) {
    var change = this.childListChangeMap.get(el);
    if (!change) {
      change = new ChildListChange();
      this.childListChangeMap.set(el, change);
    }
    return change;
  };
  MutationProjection.prototype.processChildlistChanges = function () {
    if (this.childListChangeMap) return;
    this.childListChangeMap = new NodeMap();
    for (var i = 0; i < this.mutations.length; i++) {
      var mutation = this.mutations[i];
      if (mutation.type != "childList") continue;
      if (
        this.treeChanges.reachabilityChange(mutation.target) !==
          Movement.STAYED_IN &&
        !this.calcOldPreviousSibling
      )
        continue;
      var change = this.getChildlistChange(mutation.target);
      var oldPrevious = mutation.previousSibling;
      function recordOldPrevious(node, previous) {
        if (
          !node ||
          change.oldPrevious.has(node) ||
          change.added.has(node) ||
          change.maybeMoved.has(node)
        )
          return;
        if (
          previous &&
          (change.added.has(previous) || change.maybeMoved.has(previous))
        )
          return;
        change.oldPrevious.set(node, previous);
      }
      for (var j = 0; j < mutation.removedNodes.length; j++) {
        var node = mutation.removedNodes[j];
        recordOldPrevious(node, oldPrevious);
        if (change.added.has(node)) {
          change.added.delete(node);
        } else {
          change.removed.set(node, true);
          change.maybeMoved.delete(node);
        }
        oldPrevious = node;
      }
      recordOldPrevious(mutation.nextSibling, oldPrevious);
      for (var j = 0; j < mutation.addedNodes.length; j++) {
        var node = mutation.addedNodes[j];
        if (change.removed.has(node)) {
          change.removed.delete(node);
          change.maybeMoved.set(node, true);
        } else {
          change.added.set(node, true);
        }
      }
    }
  };
  MutationProjection.prototype.wasReordered = function (node) {
    if (!this.treeChanges.anyParentsChanged) return false;
    this.processChildlistChanges();
    var parentNode = node.parentNode;
    var nodeChange = this.treeChanges.get(node);
    if (nodeChange && nodeChange.oldParentNode)
      parentNode = nodeChange.oldParentNode;
    var change = this.childListChangeMap.get(parentNode);
    if (!change) return false;
    if (change.moved) return change.moved.get(node);
    change.moved = new NodeMap();
    var pendingMoveDecision = new NodeMap();
    function isMoved(node) {
      if (!node) return false;
      if (!change.maybeMoved.has(node)) return false;
      var didMove = change.moved.get(node);
      if (didMove !== undefined) return didMove;
      if (pendingMoveDecision.has(node)) {
        didMove = true;
      } else {
        pendingMoveDecision.set(node, true);
        didMove = getPrevious(node) !== getOldPrevious(node);
      }
      if (pendingMoveDecision.has(node)) {
        pendingMoveDecision.delete(node);
        change.moved.set(node, didMove);
      } else {
        didMove = change.moved.get(node);
      }
      return didMove;
    }
    var oldPreviousCache = new NodeMap();
    function getOldPrevious(node) {
      var oldPrevious = oldPreviousCache.get(node);
      if (oldPrevious !== undefined) return oldPrevious;
      oldPrevious = change.oldPrevious.get(node);
      while (
        oldPrevious &&
        (change.removed.has(oldPrevious) || isMoved(oldPrevious))
      ) {
        oldPrevious = getOldPrevious(oldPrevious);
      }
      if (oldPrevious === undefined) oldPrevious = node.previousSibling;
      oldPreviousCache.set(node, oldPrevious);
      return oldPrevious;
    }
    var previousCache = new NodeMap();
    function getPrevious(node) {
      if (previousCache.has(node)) return previousCache.get(node);
      var previous = node.previousSibling;
      while (previous && (change.added.has(previous) || isMoved(previous)))
        previous = previous.previousSibling;
      previousCache.set(node, previous);
      return previous;
    }
    change.maybeMoved.keys().forEach(isMoved);
    return change.moved.get(node);
  };
  return MutationProjection;
})();
var Summary = (function () {
  function Summary(projection, query) {
    var _this = this;
    this.projection = projection;
    this.added = [];
    this.removed = [];
    this.reparented =
      query.all || query.element || query.characterData ? [] : undefined;
    this.reordered = query.all ? [] : undefined;
    projection.getChanged(this, query.elementFilter, query.characterData);
    if (query.all || query.attribute || query.attributeList) {
      var filter = query.attribute ? [query.attribute] : query.attributeList;
      var attributeChanged = projection.attributeChangedNodes(filter);
      if (query.attribute) {
        this.valueChanged = attributeChanged[query.attribute] || [];
      } else {
        this.attributeChanged = attributeChanged;
        if (query.attributeList) {
          query.attributeList.forEach(function (attrName) {
            if (!_this.attributeChanged.hasOwnProperty(attrName))
              _this.attributeChanged[attrName] = [];
          });
        }
      }
    }
    if (query.all || query.characterData) {
      var characterDataChanged = projection.getCharacterDataChanged();
      if (query.characterData) this.valueChanged = characterDataChanged;
      else this.characterDataChanged = characterDataChanged;
    }
    if (this.reordered)
      this.getOldPreviousSibling =
        projection.getOldPreviousSibling.bind(projection);
  }
  Summary.prototype.getOldParentNode = function (node) {
    return this.projection.getOldParentNode(node);
  };
  Summary.prototype.getOldAttribute = function (node, name) {
    return this.projection.getOldAttribute(node, name);
  };
  Summary.prototype.getOldCharacterData = function (node) {
    return this.projection.getOldCharacterData(node);
  };
  Summary.prototype.getOldPreviousSibling = function (node) {
    return this.projection.getOldPreviousSibling(node);
  };
  return Summary;
})();
// TODO(rafaelw): Allow ':' and '.' as valid name characters.
var validNameInitialChar = /[a-zA-Z_]+/;
var validNameNonInitialChar = /[a-zA-Z0-9_\-]+/;
// TODO(rafaelw): Consider allowing backslash in the attrValue.
// TODO(rafaelw): There's got a to be way to represent this state machine
// more compactly???
function escapeQuotes(value) {
  return '"' + value.replace(/"/, '\\"') + '"';
}
var Qualifier = (function () {
  function Qualifier() {}
  Qualifier.prototype.matches = function (oldValue) {
    if (oldValue === null) return false;
    if (this.attrValue === undefined) return true;
    if (!this.contains) return this.attrValue == oldValue;
    var tokens = oldValue.split(" ");
    for (var i = 0; i < tokens.length; i++) {
      if (this.attrValue === tokens[i]) return true;
    }
    return false;
  };
  Qualifier.prototype.toString = function () {
    if (this.attrName === "class" && this.contains) return "." + this.attrValue;
    if (this.attrName === "id" && !this.contains) return "#" + this.attrValue;
    if (this.contains)
      return "[" + this.attrName + "~=" + escapeQuotes(this.attrValue) + "]";
    if ("attrValue" in this)
      return "[" + this.attrName + "=" + escapeQuotes(this.attrValue) + "]";
    return "[" + this.attrName + "]";
  };
  return Qualifier;
})();
var Selector = (function () {
  function Selector() {
    this.uid = Selector.nextUid++;
    this.qualifiers = [];
  }
  Object.defineProperty(Selector.prototype, "caseInsensitiveTagName", {
    get: function () {
      return this.tagName.toUpperCase();
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(Selector.prototype, "selectorString", {
    get: function () {
      return this.tagName + this.qualifiers.join("");
    },
    enumerable: true,
    configurable: true,
  });
  Selector.prototype.isMatching = function (el) {
    return el[Selector.matchesSelector](this.selectorString);
  };
  Selector.prototype.wasMatching = function (el, change, isMatching) {
    if (!change || !change.attributes) return isMatching;
    var tagName = change.isCaseInsensitive
      ? this.caseInsensitiveTagName
      : this.tagName;
    if (tagName !== "*" && tagName !== el.tagName) return false;
    var attributeOldValues = [];
    var anyChanged = false;
    for (var i = 0; i < this.qualifiers.length; i++) {
      var qualifier = this.qualifiers[i];
      var oldValue = change.getAttributeOldValue(qualifier.attrName);
      attributeOldValues.push(oldValue);
      anyChanged = anyChanged || oldValue !== undefined;
    }
    if (!anyChanged) return isMatching;
    for (var i = 0; i < this.qualifiers.length; i++) {
      var qualifier = this.qualifiers[i];
      var oldValue = attributeOldValues[i];
      if (oldValue === undefined)
        oldValue = el.getAttribute(qualifier.attrName);
      if (!qualifier.matches(oldValue)) return false;
    }
    return true;
  };
  Selector.prototype.matchabilityChange = function (el, change) {
    var isMatching = this.isMatching(el);
    if (isMatching)
      return this.wasMatching(el, change, isMatching)
        ? Movement.STAYED_IN
        : Movement.ENTERED;
    else
      return this.wasMatching(el, change, isMatching)
        ? Movement.EXITED
        : Movement.STAYED_OUT;
  };
  Selector.parseSelectors = function (input) {
    var selectors = [];
    var currentSelector;
    var currentQualifier;
    function newSelector() {
      if (currentSelector) {
        if (currentQualifier) {
          currentSelector.qualifiers.push(currentQualifier);
          currentQualifier = undefined;
        }
        selectors.push(currentSelector);
      }
      currentSelector = new Selector();
    }
    function newQualifier() {
      if (currentQualifier) currentSelector.qualifiers.push(currentQualifier);
      currentQualifier = new Qualifier();
    }
    var WHITESPACE = /\s/;
    var valueQuoteChar;
    var SYNTAX_ERROR = "Invalid or unsupported selector syntax.";
    var SELECTOR = 1;
    var TAG_NAME = 2;
    var QUALIFIER = 3;
    var QUALIFIER_NAME_FIRST_CHAR = 4;
    var QUALIFIER_NAME = 5;
    var ATTR_NAME_FIRST_CHAR = 6;
    var ATTR_NAME = 7;
    var EQUIV_OR_ATTR_QUAL_END = 8;
    var EQUAL = 9;
    var ATTR_QUAL_END = 10;
    var VALUE_FIRST_CHAR = 11;
    var VALUE = 12;
    var QUOTED_VALUE = 13;
    var SELECTOR_SEPARATOR = 14;
    var state = SELECTOR;
    var i = 0;
    while (i < input.length) {
      var c = input[i++];
      switch (state) {
        case SELECTOR:
          if (c.match(validNameInitialChar)) {
            newSelector();
            currentSelector.tagName = c;
            state = TAG_NAME;
            break;
          }
          if (c == "*") {
            newSelector();
            currentSelector.tagName = "*";
            state = QUALIFIER;
            break;
          }
          if (c == ".") {
            newSelector();
            newQualifier();
            currentSelector.tagName = "*";
            currentQualifier.attrName = "class";
            currentQualifier.contains = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "#") {
            newSelector();
            newQualifier();
            currentSelector.tagName = "*";
            currentQualifier.attrName = "id";
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "[") {
            newSelector();
            newQualifier();
            currentSelector.tagName = "*";
            currentQualifier.attrName = "";
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }
          if (c.match(WHITESPACE)) break;
          throw Error(SYNTAX_ERROR);
        case TAG_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentSelector.tagName += c;
            break;
          }
          if (c == ".") {
            newQualifier();
            currentQualifier.attrName = "class";
            currentQualifier.contains = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "#") {
            newQualifier();
            currentQualifier.attrName = "id";
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "[") {
            newQualifier();
            currentQualifier.attrName = "";
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }
          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }
          if (c == ",") {
            state = SELECTOR;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case QUALIFIER:
          if (c == ".") {
            newQualifier();
            currentQualifier.attrName = "class";
            currentQualifier.contains = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "#") {
            newQualifier();
            currentQualifier.attrName = "id";
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "[") {
            newQualifier();
            currentQualifier.attrName = "";
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }
          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }
          if (c == ",") {
            state = SELECTOR;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case QUALIFIER_NAME_FIRST_CHAR:
          if (c.match(validNameInitialChar)) {
            currentQualifier.attrValue = c;
            state = QUALIFIER_NAME;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case QUALIFIER_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentQualifier.attrValue += c;
            break;
          }
          if (c == ".") {
            newQualifier();
            currentQualifier.attrName = "class";
            currentQualifier.contains = true;
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "#") {
            newQualifier();
            currentQualifier.attrName = "id";
            state = QUALIFIER_NAME_FIRST_CHAR;
            break;
          }
          if (c == "[") {
            newQualifier();
            state = ATTR_NAME_FIRST_CHAR;
            break;
          }
          if (c.match(WHITESPACE)) {
            state = SELECTOR_SEPARATOR;
            break;
          }
          if (c == ",") {
            state = SELECTOR;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case ATTR_NAME_FIRST_CHAR:
          if (c.match(validNameInitialChar)) {
            currentQualifier.attrName = c;
            state = ATTR_NAME;
            break;
          }
          if (c.match(WHITESPACE)) break;
          throw Error(SYNTAX_ERROR);
        case ATTR_NAME:
          if (c.match(validNameNonInitialChar)) {
            currentQualifier.attrName += c;
            break;
          }
          if (c.match(WHITESPACE)) {
            state = EQUIV_OR_ATTR_QUAL_END;
            break;
          }
          if (c == "~") {
            currentQualifier.contains = true;
            state = EQUAL;
            break;
          }
          if (c == "=") {
            currentQualifier.attrValue = "";
            state = VALUE_FIRST_CHAR;
            break;
          }
          if (c == "]") {
            state = QUALIFIER;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case EQUIV_OR_ATTR_QUAL_END:
          if (c == "~") {
            currentQualifier.contains = true;
            state = EQUAL;
            break;
          }
          if (c == "=") {
            currentQualifier.attrValue = "";
            state = VALUE_FIRST_CHAR;
            break;
          }
          if (c == "]") {
            state = QUALIFIER;
            break;
          }
          if (c.match(WHITESPACE)) break;
          throw Error(SYNTAX_ERROR);
        case EQUAL:
          if (c == "=") {
            currentQualifier.attrValue = "";
            state = VALUE_FIRST_CHAR;
            break;
          }
          throw Error(SYNTAX_ERROR);
        case ATTR_QUAL_END:
          if (c == "]") {
            state = QUALIFIER;
            break;
          }
          if (c.match(WHITESPACE)) break;
          throw Error(SYNTAX_ERROR);
        case VALUE_FIRST_CHAR:
          if (c.match(WHITESPACE)) break;
          if (c == '"' || c == "'") {
            valueQuoteChar = c;
            state = QUOTED_VALUE;
            break;
          }
          currentQualifier.attrValue += c;
          state = VALUE;
          break;
        case VALUE:
          if (c.match(WHITESPACE)) {
            state = ATTR_QUAL_END;
            break;
          }
          if (c == "]") {
            state = QUALIFIER;
            break;
          }
          if (c == "'" || c == '"') throw Error(SYNTAX_ERROR);
          currentQualifier.attrValue += c;
          break;
        case QUOTED_VALUE:
          if (c == valueQuoteChar) {
            state = ATTR_QUAL_END;
            break;
          }
          currentQualifier.attrValue += c;
          break;
        case SELECTOR_SEPARATOR:
          if (c.match(WHITESPACE)) break;
          if (c == ",") {
            state = SELECTOR;
            break;
          }
          throw Error(SYNTAX_ERROR);
      }
    }
    switch (state) {
      case SELECTOR:
      case TAG_NAME:
      case QUALIFIER:
      case QUALIFIER_NAME:
      case SELECTOR_SEPARATOR:
        // Valid end states.
        newSelector();
        break;
      default:
        throw Error(SYNTAX_ERROR);
    }
    if (!selectors.length) throw Error(SYNTAX_ERROR);
    return selectors;
  };
  Selector.nextUid = 1;
  Selector.matchesSelector = (function () {
    var element = document.createElement("div");
    if (typeof element["webkitMatchesSelector"] === "function")
      return "webkitMatchesSelector";
    if (typeof element["mozMatchesSelector"] === "function")
      return "mozMatchesSelector";
    if (typeof element["msMatchesSelector"] === "function")
      return "msMatchesSelector";
    return "matchesSelector";
  })();
  return Selector;
})();
var attributeFilterPattern = /^([a-zA-Z:_]+[a-zA-Z0-9_\-:\.]*)$/;
function validateAttribute(attribute) {
  if (typeof attribute != "string")
    throw Error(
      "Invalid request opion. attribute must be a non-zero length string."
    );
  attribute = attribute.trim();
  if (!attribute)
    throw Error(
      "Invalid request opion. attribute must be a non-zero length string."
    );
  if (!attribute.match(attributeFilterPattern))
    throw Error("Invalid request option. invalid attribute name: " + attribute);
  return attribute;
}
function validateElementAttributes(attribs) {
  if (!attribs.trim().length)
    throw Error(
      "Invalid request option: elementAttributes must contain at least one attribute."
    );
  var lowerAttributes = {};
  var attributes = {};
  var tokens = attribs.split(/\s+/);
  for (var i = 0; i < tokens.length; i++) {
    var name = tokens[i];
    if (!name) continue;
    var name = validateAttribute(name);
    var nameLower = name.toLowerCase();
    if (lowerAttributes[nameLower])
      throw Error(
        "Invalid request option: observing multiple case variations of the same attribute is not supported."
      );
    attributes[name] = true;
    lowerAttributes[nameLower] = true;
  }
  return Object.keys(attributes);
}
function elementFilterAttributes(selectors) {
  var attributes = {};
  selectors.forEach(function (selector) {
    selector.qualifiers.forEach(function (qualifier) {
      attributes[qualifier.attrName] = true;
    });
  });
  return Object.keys(attributes);
}
var MutationSummary = (function () {
  function MutationSummary(opts) {
    var _this = this;
    this.connected = false;
    this.options = MutationSummary.validateOptions(opts);
    this.observerOptions = MutationSummary.createObserverOptions(
      this.options.queries
    );
    this.root = this.options.rootNode;
    this.callback = this.options.callback;
    this.elementFilter = Array.prototype.concat.apply(
      [],
      this.options.queries.map(function (query) {
        return query.elementFilter ? query.elementFilter : [];
      })
    );
    if (!this.elementFilter.length) this.elementFilter = undefined;
    this.calcReordered = this.options.queries.some(function (query) {
      return query.all;
    });
    this.queryValidators = []; // TODO(rafaelw): Shouldn't always define this.
    if (MutationSummary.createQueryValidator) {
      this.queryValidators = this.options.queries.map(function (query) {
        return MutationSummary.createQueryValidator(_this.root, query);
      });
    }
    this.observer = new MutationObserverCtor(function (mutations) {
      _this.observerCallback(mutations);
    });
    this.reconnect();
  }
  MutationSummary.createObserverOptions = function (queries) {
    var observerOptions = {
      childList: true,
      subtree: true,
    };
    var attributeFilter;
    function observeAttributes(attributes) {
      if (observerOptions.attributes && !attributeFilter) return; // already observing all.
      observerOptions.attributes = true;
      observerOptions.attributeOldValue = true;
      if (!attributes) {
        // observe all.
        attributeFilter = undefined;
        return;
      }
      // add to observed.
      attributeFilter = attributeFilter || {};
      attributes.forEach(function (attribute) {
        attributeFilter[attribute] = true;
        attributeFilter[attribute.toLowerCase()] = true;
      });
    }
    queries.forEach(function (query) {
      if (query.characterData) {
        observerOptions.characterData = true;
        observerOptions.characterDataOldValue = true;
        return;
      }
      if (query.all) {
        observeAttributes();
        observerOptions.characterData = true;
        observerOptions.characterDataOldValue = true;
        return;
      }
      if (query.attribute) {
        observeAttributes([query.attribute.trim()]);
        return;
      }
      var attributes = elementFilterAttributes(query.elementFilter).concat(
        query.attributeList || []
      );
      if (attributes.length) observeAttributes(attributes);
    });
    if (attributeFilter)
      observerOptions.attributeFilter = Object.keys(attributeFilter);
    return observerOptions;
  };
  MutationSummary.validateOptions = function (options) {
    for (var prop in options) {
      if (!(prop in MutationSummary.optionKeys))
        throw Error("Invalid option: " + prop);
    }
    if (typeof options.callback !== "function")
      throw Error(
        "Invalid options: callback is required and must be a function"
      );
    if (!options.queries || !options.queries.length)
      throw Error(
        "Invalid options: queries must contain at least one query request object."
      );
    var opts = {
      callback: options.callback,
      rootNode: options.rootNode || document,
      observeOwnChanges: !!options.observeOwnChanges,
      oldPreviousSibling: !!options.oldPreviousSibling,
      queries: [],
    };
    for (var i = 0; i < options.queries.length; i++) {
      var request = options.queries[i];
      // all
      if (request.all) {
        if (Object.keys(request).length > 1)
          throw Error("Invalid request option. all has no options.");
        opts.queries.push({ all: true });
        continue;
      }
      // attribute
      if ("attribute" in request) {
        var query = {
          attribute: validateAttribute(request.attribute),
        };
        query.elementFilter = Selector.parseSelectors(
          "*[" + query.attribute + "]"
        );
        if (Object.keys(request).length > 1)
          throw Error("Invalid request option. attribute has no options.");
        opts.queries.push(query);
        continue;
      }
      // element
      if ("element" in request) {
        var requestOptionCount = Object.keys(request).length;
        var query = {
          element: request.element,
          elementFilter: Selector.parseSelectors(request.element),
        };
        if (request.hasOwnProperty("elementAttributes")) {
          query.attributeList = validateElementAttributes(
            request.elementAttributes
          );
          requestOptionCount--;
        }
        if (requestOptionCount > 1)
          throw Error(
            "Invalid request option. element only allows elementAttributes option."
          );
        opts.queries.push(query);
        continue;
      }
      // characterData
      if (request.characterData) {
        if (Object.keys(request).length > 1)
          throw Error("Invalid request option. characterData has no options.");
        opts.queries.push({ characterData: true });
        continue;
      }
      throw Error("Invalid request option. Unknown query request.");
    }
    return opts;
  };
  MutationSummary.prototype.createSummaries = function (mutations) {
    if (!mutations || !mutations.length) return [];
    var projection = new MutationProjection(
      this.root,
      mutations,
      this.elementFilter,
      this.calcReordered,
      this.options.oldPreviousSibling
    );
    var summaries = [];
    for (var i = 0; i < this.options.queries.length; i++) {
      summaries.push(new Summary(projection, this.options.queries[i]));
    }
    return summaries;
  };
  MutationSummary.prototype.checkpointQueryValidators = function () {
    this.queryValidators.forEach(function (validator) {
      if (validator) validator.recordPreviousState();
    });
  };
  MutationSummary.prototype.runQueryValidators = function (summaries) {
    this.queryValidators.forEach(function (validator, index) {
      if (validator) validator.validate(summaries[index]);
    });
  };
  MutationSummary.prototype.changesToReport = function (summaries) {
    return summaries.some(function (summary) {
      var summaryProps = [
        "added",
        "removed",
        "reordered",
        "reparented",
        "valueChanged",
        "characterDataChanged",
      ];
      if (
        summaryProps.some(function (prop) {
          return summary[prop] && summary[prop].length;
        })
      )
        return true;
      if (summary.attributeChanged) {
        var attrNames = Object.keys(summary.attributeChanged);
        var attrsChanged = attrNames.some(function (attrName) {
          return !!summary.attributeChanged[attrName].length;
        });
        if (attrsChanged) return true;
      }
      return false;
    });
  };
  MutationSummary.prototype.observerCallback = function (mutations) {
    if (!this.options.observeOwnChanges) this.observer.disconnect();
    var summaries = this.createSummaries(mutations);
    this.runQueryValidators(summaries);
    if (this.options.observeOwnChanges) this.checkpointQueryValidators();
    if (this.changesToReport(summaries)) this.callback(summaries);
    // disconnect() may have been called during the callback.
    if (!this.options.observeOwnChanges && this.connected) {
      this.checkpointQueryValidators();
      this.observer.observe(this.root, this.observerOptions);
    }
  };
  MutationSummary.prototype.reconnect = function () {
    if (this.connected) throw Error("Already connected");
    this.observer.observe(this.root, this.observerOptions);
    this.connected = true;
    this.checkpointQueryValidators();
  };
  MutationSummary.prototype.takeSummaries = function () {
    if (!this.connected) throw Error("Not connected");
    var summaries = this.createSummaries(this.observer.takeRecords());
    return this.changesToReport(summaries) ? summaries : undefined;
  };
  MutationSummary.prototype.disconnect = function () {
    var summaries = this.takeSummaries();
    this.observer.disconnect();
    this.connected = false;
    return summaries;
  };
  MutationSummary.NodeMap = NodeMap; // exposed for use in TreeMirror.
  MutationSummary.parseElementFilter = Selector.parseSelectors; // exposed for testing.
  MutationSummary.optionKeys = {
    callback: true,
    queries: true,
    rootNode: true,
    oldPreviousSibling: true,
    observeOwnChanges: true,
  };
  return MutationSummary;
})();

var TreeMirror = (function () {
  function TreeMirror(root, delegate) {
    this.root = root;
    this.delegate = delegate;
    this.idMap = {};
  }
  TreeMirror.prototype.initialize = function (rootId, children) {
    this.idMap[rootId] = this.root;
    for (var i = 0; i < children.length; i++)
      this.deserializeNode(children[i], this.root);
  };
  TreeMirror.prototype.applyChanged = function (
    removed,
    addedOrMoved,
    attributes,
    text
  ) {
    var _this = this;
    // NOTE: Applying the changes can result in an attempting to add a child
    // to a parent which is presently an ancestor of the parent. This can occur
    // based on random ordering of moves. The way we handle this is to first
    // remove all changed nodes from their parents, then apply.
    addedOrMoved.forEach(function (data) {
      var node = _this.deserializeNode(data);
      var parent = _this.deserializeNode(data.parentNode);
      var previous = _this.deserializeNode(data.previousSibling);
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    removed.forEach(function (data) {
      var node = _this.deserializeNode(data);
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    addedOrMoved.forEach(function (data) {
      var node = _this.deserializeNode(data);
      var parent = _this.deserializeNode(data.parentNode);
      var previous = _this.deserializeNode(data.previousSibling);
      parent.insertBefore(
        node,
        previous ? previous.nextSibling : parent.firstChild
      );
    });
    attributes.forEach(function (data) {
      var node = _this.deserializeNode(data);
      Object.keys(data.attributes).forEach(function (attrName) {
        var newVal = data.attributes[attrName];
        if (newVal === null) {
          node.removeAttribute(attrName);
        } else {
          if (
            !_this.delegate ||
            !_this.delegate.setAttribute ||
            !_this.delegate.setAttribute(node, attrName, newVal)
          ) {
            node.setAttribute(attrName, newVal);
          }
        }
      });
    });
    text.forEach(function (data) {
      var node = _this.deserializeNode(data);
      node.textContent = data.textContent;
    });
    removed.forEach(function (node) {
      delete _this.idMap[node.id];
    });
  };
  TreeMirror.prototype.deserializeNode = function (nodeData, parent) {
    var _this = this;
    if (nodeData === null) return null;
    var node = this.idMap[nodeData.id];
    if (node) return node;
    var doc = this.root.ownerDocument;
    if (doc === null) doc = this.root;
    switch (nodeData.nodeType) {
      case Node.COMMENT_NODE:
        node = doc.createComment(nodeData.textContent);
        break;
      case Node.TEXT_NODE:
        node = doc.createTextNode(nodeData.textContent);
        break;
      case Node.DOCUMENT_TYPE_NODE:
        node = doc.implementation.createDocumentType(
          nodeData.name,
          nodeData.publicId,
          nodeData.systemId
        );
        break;
      case Node.ELEMENT_NODE:
        if (this.delegate && this.delegate.createElement)
          node = this.delegate.createElement(nodeData.tagName);
        if (!node) node = doc.createElement(nodeData.tagName);
        Object.keys(nodeData.attributes).forEach(function (name) {
          if (
            !_this.delegate ||
            !_this.delegate.setAttribute ||
            !_this.delegate.setAttribute(node, name, nodeData.attributes[name])
          ) {
            node.setAttribute(name, nodeData.attributes[name]);
          }
        });
        break;
    }
    if (!node) throw "ouch";
    this.idMap[nodeData.id] = node;
    if (parent) parent.appendChild(node);
    if (nodeData.childNodes) {
      for (var i = 0; i < nodeData.childNodes.length; i++)
        this.deserializeNode(nodeData.childNodes[i], node);
    }
    return node;
  };
  return TreeMirror;
})();
var TreeMirrorClient = (function () {
  function TreeMirrorClient(target, mirror, testingQueries) {
    var _this = this;
    this.target = target;
    this.mirror = mirror;
    this.nextId = 1;
    this.knownNodes = new MutationSummary.NodeMap();
    var rootId = this.serializeNode(target).id;
    var children = [];
    for (var child = target.firstChild; child; child = child.nextSibling)
      children.push(this.serializeNode(child, true));
    this.mirror.initialize(rootId, children);
    var self = this;
    var queries = [{ all: true }];
    if (testingQueries) queries = queries.concat(testingQueries);
    this.mutationSummary = new MutationSummary({
      rootNode: target,
      callback: function (summaries) {
        _this.applyChanged(summaries);
      },
      queries: queries,
    });
  }
  TreeMirrorClient.prototype.disconnect = function () {
    if (this.mutationSummary) {
      this.mutationSummary.disconnect();
      this.mutationSummary = undefined;
    }
  };
  TreeMirrorClient.prototype.rememberNode = function (node) {
    var id = this.nextId++;
    this.knownNodes.set(node, id);
    return id;
  };
  TreeMirrorClient.prototype.forgetNode = function (node) {
    this.knownNodes.delete(node);
  };
  TreeMirrorClient.prototype.serializeNode = function (node, recursive) {
    if (node === null) return null;
    var id = this.knownNodes.get(node);
    if (id !== undefined) {
      return { id: id };
    }
    var data = {
      nodeType: node.nodeType,
      id: this.rememberNode(node),
    };
    switch (data.nodeType) {
      case Node.DOCUMENT_TYPE_NODE:
        var docType = node;
        data.name = docType.name;
        data.publicId = docType.publicId;
        data.systemId = docType.systemId;
        break;
      case Node.COMMENT_NODE:
      case Node.TEXT_NODE:
        data.textContent = node.textContent;
        break;
      case Node.ELEMENT_NODE:
        var elm = node;
        data.tagName = elm.tagName;
        data.attributes = {};
        for (var i = 0; i < elm.attributes.length; i++) {
          var attr = elm.attributes[i];
          data.attributes[attr.name] = attr.value;
        }
        if (recursive && elm.childNodes.length) {
          data.childNodes = [];
          for (var child = elm.firstChild; child; child = child.nextSibling)
            data.childNodes.push(this.serializeNode(child, true));
        }
        break;
    }
    return data;
  };
  TreeMirrorClient.prototype.serializeAddedAndMoved = function (
    added,
    reparented,
    reordered
  ) {
    var _this = this;
    var all = added.concat(reparented).concat(reordered);
    var parentMap = new MutationSummary.NodeMap();
    all.forEach(function (node) {
      var parent = node.parentNode;
      var children = parentMap.get(parent);
      if (!children) {
        children = new MutationSummary.NodeMap();
        parentMap.set(parent, children);
      }
      children.set(node, true);
    });
    var moved = [];
    parentMap.keys().forEach(function (parent) {
      var children = parentMap.get(parent);
      var keys = children.keys();
      while (keys.length) {
        var node = keys[0];
        while (node.previousSibling && children.has(node.previousSibling))
          node = node.previousSibling;
        while (node && children.has(node)) {
          var data = _this.serializeNode(node);
          data.previousSibling = _this.serializeNode(node.previousSibling);
          data.parentNode = _this.serializeNode(node.parentNode);
          moved.push(data);
          children.delete(node);
          node = node.nextSibling;
        }
        var keys = children.keys();
      }
    });
    return moved;
  };
  TreeMirrorClient.prototype.serializeAttributeChanges = function (
    attributeChanged
  ) {
    var _this = this;
    var map = new MutationSummary.NodeMap();
    Object.keys(attributeChanged).forEach(function (attrName) {
      attributeChanged[attrName].forEach(function (element) {
        var record = map.get(element);
        if (!record) {
          record = _this.serializeNode(element);
          record.attributes = {};
          map.set(element, record);
        }
        record.attributes[attrName] = element.getAttribute(attrName);
      });
    });
    return map.keys().map(function (node) {
      return map.get(node);
    });
  };
  TreeMirrorClient.prototype.applyChanged = function (summaries) {
    var _this = this;
    var summary = summaries[0];
    var removed = summary.removed.map(function (node) {
      return _this.serializeNode(node);
    });
    var moved = this.serializeAddedAndMoved(
      summary.added,
      summary.reparented,
      summary.reordered
    );
    var attributes = this.serializeAttributeChanges(summary.attributeChanged);
    var text = summary.characterDataChanged.map(function (node) {
      var data = _this.serializeNode(node);
      data.textContent = node.textContent;
      return data;
    });
    this.mirror.applyChanged(removed, moved, attributes, text);
    summary.removed.forEach(function (node) {
      _this.forgetNode(node);
    });
  };
  return TreeMirrorClient;
})();

let mirrorClient;
const redactedNodeIds = {};
const redactedClass = 'spr-cobrowse-redact';
const redactedAttribute = 'data-redaction';

let clientID = '';
let isInitiated = false;
/**
 * Function to render the agent's red pointer on client side
 * @param msg The cursor pointer details
 */
const INF = `21474836`;

const renderCursor = (msg) => {
  const { x, y } = msg;
  const agentCursor = document.getElementById('agent_cursor');
  agentCursor.style.visibility = 'visible';
  agentCursor.style.position = 'absolute';
  agentCursor.style.height = '20px';
  agentCursor.style.width = '20px';
  agentCursor.style.left = x - 10 + 'px';
  agentCursor.style.top = y - 10 + 'px';
  agentCursor.style.backgroundColor = 'red';
  agentCursor.style.borderRadius = '100%';
  agentCursor.style.zIndex = INF;
};
/**
 * Handles the agent's pointer movement to display on the client side
 * @param msg The cursor pointer details
 */
const handleMousePositon = (msg) => {
  renderCursor(msg);
};

/**
 * @param id The id of the DOM node in the mirror client to return
 * @returns The DOM node having the given id
 */
const getNodeById = (id) => {
  const nodes = mirrorClient.knownNodes.nodes;
  return nodes[id];
};

/**
 * @param node The node whose id to return
 * @returns The id of the given node
 */
const getIdByNode = (node) => {
  for (let i in mirrorClient.knownNodes.nodes) {
    if (mirrorClient.knownNodes.nodes[i] === node) {
      return i;
    }
  }
  return -1;
};

/**
 * Propagates the redaction attribute to the children and sets their dimension attributes
 * @param node The current DOM node
 * @param isRedactedChild Tells if the current node is a child of a redacted element
 */
const dfs = (node, isRedactedChild) => {
  if (node === null || node === undefined) {
    return;
  }
  if (
    node.attributes !== undefined &&
    (isRedactedChild ||
      (node.classList !== undefined && node.classList.contains(redactedClass)))
  ) {
    const height = node.getBoundingClientRect().height;
    const width = node.getBoundingClientRect().width;
    node.setAttribute('data-height', height);
    node.setAttribute('data-width', width);
    node.setAttribute(redactedAttribute, true);
    isRedactedChild = true;
  }

  for (let child of node.childNodes) {
    dfs(child, isRedactedChild);
  }
};

/**
 * Redacts the given node by clearing its value attribute and setting its background as black
 * @param node The node which is to be redacted
 * @param height The height of the given node
 * @param width The width of the given node
 * @returns The redacted node
 */
const getRedactedNode = (node, height, width) => {
  if (node === undefined) {
    return null;
  }
  const newNode = node;
  if (
    newNode.attributes !== undefined &&
    newNode.attributes.style === undefined
  ) {
    newNode.attributes.style = `background: black;`;
  } else {
    if (newNode.attributes !== undefined) {
      newNode.attributes = {};
    }
    newNode.attributes.style += `background: black;`;
  }
  newNode.attributes.style += `height: ${height}px; width: ${width}px;`;

  if (newNode.attributes.value !== undefined) {
    newNode.attributes.value = '';
  }

  return newNode;
};

/**
 * Applies the redaction to the given node by setting its background as black and clearing its children and value attribute
 * @param node The current node in the DFS call
 */
const setRedactionDFS = (node) => {
  if (!node || node === undefined) {
    return;
  }

  let isRedacted = false;
  if (node.attributes && node.attributes[redactedAttribute]) {
    const height = node.attributes['data-height'],
      width = node.attributes['data-width'];
    node = getRedactedNode(node, height, width);
    isRedacted = true;
    redactedNodeIds[node.id] = true;
    node.childNodes = [];
  }

  if (!node.childNodes) {
    return;
  }

  for (let child of node.childNodes) {
    setRedactionDFS(child);
  }
};

/**
 * Returns the top most redacted ancestor of the given node
 * @param node The node whose ancestor to find
 * @returns The top most redacted ancestor or null if no redacted ancestor
 */
const climb = (node) => {
  if (node === null || node === undefined) {
    return null;
  }

  let lastRedacted = null;

  while (node !== null && node !== undefined && node !== document) {
    if (
      node.attributes !== undefined &&
      (node.attributes[redactedAttribute] ||
        (node.classList !== undefined &&
          node.classList.contains(redactedClass)))
    ) {
      lastRedacted = node;
    }
    node = node.parentElement;
  }

  return lastRedacted;
};

/**
 * Checks whether the node having given 'id' is to be redacted or not
 * @param id The 'id' of the node to check whether to redact or not
 * @returns True if the node having given 'id' is to be redacted, else returns false
 */
const checkToBeRedacted = (id) => {
  const node = getNodeById(id);
  if (
    node !== undefined &&
    node.attributes !== undefined &&
    node.attributes[redactedAttribute]
  ) {
    return true;
  }

  const topmostRedactedParent = climb(node);

  if (topmostRedactedParent) {
    return true;
  }

  return false;
};

/**
 * Checks whether the text node having given 'id' is to be redacted or not
 * @param id The 'id' of the text node to check whether to redact or not
 * @returns True if the text node having given 'id' is to be redacted, else returns false
 */
const checkToBeRedactedTextNode = (id) => {
  const currentNode = getNodeById(id);
  if (currentNode === null || currentNode === undefined) {
    return null;
  }

  const immediateParent = currentNode.parentElement;

  if (immediateParent && immediateParent !== undefined) {
    return immediateParent.hasAttribute(redactedAttribute);
  }

  return false;
};

/**
 * Recalculates dimensions and pushes the change in attributes of the top most redacted parent of nodes having given ids
 * @param nodeIds The array of ids of nodes whose dimensions to re calculate
 * @returns The attribute list containing ids and the updated styles
 */
const recalculateDimensions = (nodeIds) => {
  const newAttributeList = [];

  nodeIds.forEach((id) => {
    const node = climb(getNodeById(id));
    if (!node) {
      return;
    }

    const height = node.offsetHeight;
    const width = node.offsetWidth;
    let newId = getIdByNode(node);
    let existingInlineStyles = '';

    if (node.attributes !== undefined && node.attributes.style !== undefined) {
      existingInlineStyles = node.attributes.style.value;
    }

    const newStyle = `${existingInlineStyles} background: black; height: ${height}px; width:${width}px;`;

    newAttributeList.push({
      id: newId,
      attributes: {
        style: newStyle,
      },
    });
  });

  return newAttributeList;
};

/**
 * Recalculates dimensions and pushes the change in attributes of the top most redacted parent of text nodes having given ids
 * @param nodeIds The ids of the text nodes whose dimensions to re calculate
 * @returns The new attribute list after recalculating dimensions
 */
const recalculateTextNodeDimensions = (nodeIds) => {
  const parentIds = nodeIds.map((id) => {
    let parentNode = getNodeById(id).parentElement;
    parentNode = climb(parentNode);
    const parentId = getIdByNode(parentNode);
    return parentId;
  });

  return recalculateDimensions(parentIds);
};

/**
 * Handles the text nodes for redaction by setting their textContent as empty string and recalculating their dimensions
 * @param textNodeList The list of text nodes which are to be checked
 * @returns The updated list of text nodes after checking for redaction
 */
const handleTextChanges = (textNodeList) => {
  const redactedTextNodeIds = [];

  const newTextNodeList = textNodeList.map((textItem) => {
    const { id, textContent } = textItem;
    let newTextContent = textContent;
    const isRedacted = checkToBeRedactedTextNode(id);

    if (isRedacted && isRedacted !== undefined) {
      newTextContent = '';
      redactedTextNodeIds.push(id);
    }

    const newTextItem = { id, textContent: newTextContent };

    return newTextItem;
  });

  return [newTextNodeList, recalculateTextNodeDimensions(redactedTextNodeIds)];
};

/**
 * Checks and returns a new attribute list after taking care of redaction
 * @param attributeList The list of attribute being passed to the applyChanged() of TreeMirror
 * @returns The new list of changed attributes
 */
const handleAttributeChanges = (attributeList) => {
  const redactedNodeIds = [];

  const newAttributeList = attributeList.filter((attributeItem) => {
    const { id } = attributeItem;
    if (checkToBeRedacted(id)) {
      redactedNodeIds.push(id);
    } else {
      return attributeItem;
    }
  });

  return [...newAttributeList, ...recalculateDimensions(redactedNodeIds)];
};

/**
 * Checks and returns the updated 'addedOrMoved' attribute being passed to the applyChanged() of TreeMirror
 * @param nodeIds The list of ids which are added to or removed from the DOM
 * @returns The updated 'addedOrMoved' attribute
 */
const handleAddedOrMoved = (nodeIds) => {
  let newAttributes = [];
  let remainingNodes = [];
  nodeIds.forEach((curr) => {
    if (curr && curr !== undefined && curr.parentNode) {
      const parent = getNodeById(curr.parentNode.id);
      const topmostRedactedParent = climb(parent);

      if (topmostRedactedParent && topmostRedactedParent !== undefined) {
        const topmostRedactedParentId = Number(
          getIdByNode(topmostRedactedParent)
        );
        newAttributes.push(topmostRedactedParentId);
        redactedNodeIds[topmostRedactedParentId] = true;
      } else {
        if (
          curr.attributes !== undefined &&
          curr.attributes.class !== undefined &&
          curr.attributes.class.includes(redactedClass)
        ) {
          const node = getNodeById(curr.id);
          if (node !== undefined) {
            const height = node.getBoundingClientRect().height;
            const width = node.getBoundingClientRect().width;
            curr = getRedactedNode(curr, height, width);
          }
        }
        remainingNodes.push(curr);
      }
    } else remainingNodes.push(curr);
  });
  return [remainingNodes, recalculateDimensions(newAttributes)];
};

/**
 * Handles the removed DOM nodes
 * @param removedList The list of nodes being removed from the DOM
 * @param applyChangedArgs The arguments being passed to the applyChanged() of TreeMirror
 * @returns The updated 'removed' attribute and contents of the new attributes because of these removed nodes
 */
const handleRemoved = (removedList, applyChangedArgs) => {
  let newRemoved = [],
    newAttributeList = [];

  if (removedList.length === 0) {
    return [newRemoved, newAttributeList];
  }

  peerDataSend({
    f: 'applyChanged',
    args: applyChangedArgs,
  });

  newAttributeList = recalculateDimensions(Object.keys(redactedNodeIds));
  return [newRemoved, newAttributeList];
};

/**
 * Handles the redaction of DOM nodes
 * @param applyChangedArgs The arguments being passed to the applyChanged() of TreeMirror
 * @returns The updated arguments to pass to the applyChanged() of TreeMirror
 */
const handleRedaction = (applyChangedArgs) => {
  const [removed, addedOrMoved, attributes, text] = applyChangedArgs;
  const [newText, redactedTextAttributes] = handleTextChanges(text);
  const redactedAttributes = handleAttributeChanges(attributes);
  const [newAddedOrMoved, newAttributesAdded] =
    handleAddedOrMoved(addedOrMoved);
  const [newRemoved, newAttributesRemoved] = handleRemoved(
    removed,
    applyChangedArgs
  );
  const newAttributes = [
    ...redactedTextAttributes,
    ...redactedAttributes,
    ...newAttributesAdded,
    ...newAttributesRemoved,
  ];
  const newApplyChangedArgs = [
    newRemoved,
    newAddedOrMoved,
    newAttributes,
    newText,
  ];
  return newApplyChangedArgs;
};

/**
 * @param topic The plain topic name
 * @returns The updated topic after prefixing it with client id
 */
const getTopic = (topic) => {
  return clientID + '/' + topic;
};
const publish = (topic, msg) => {
  let message = new Paho.MQTT.Message(msg);
  message.destinationName = topic;
  client.send(message);
};
/**
 * Sends client's DOM details to the agent
 * Invokes handleMessage() on the agent's side
 * @param message The message to publish
 */
const peerDataSend = (msg) => {
  publish(getTopic('presence'), compressData(msg));
};

/**
 * Sends the client's viewport dimension details to the agent
 * @param msg The current viewport dimension of the client
 */
const clientToAgentScreen = (msg) => {
  publish(getTopic('clientScreen'), compressData(msg));
};

/**
 * Sends client's mouse coordinates to the agent
 * @param e The event object
 */
const sendMouseCoordinates = (e) => {
  const mousePos = {
    x: e.pageX,
    y: e.pageY,
  };
  peerDataSend({ mouse: mousePos });
};

/**
 * Sends client's scroll coordinates to the agent
 */
const sendScroll = () => {
  const verScroll =
    document.documentElement.scrollTop || document.body.scrollTop;
  peerDataSend({ scroll: verScroll });
};

/**
 * Retrieves client's viewport dimensions and sends it to the agent
 */
const sendDimensions = () => {
  const obj = { height: window.innerHeight, width: innerWidth };
  clientToAgentScreen({ obj: obj });
};

const clearCanvasImage = () => {
  const img = document.getElementById('canvasImg');
  img.removeAttribute('src');
};

/**
 * Shows the agent's annotated canvas image on the client's side
 * @param imgObj Object containing agent's annotated canvas image details
 */
const showCanvasImage = ({ imgSrc, left, top }) => {
  const img = document.getElementById('canvasImg');
  img.setAttribute('src', imgSrc);
  img.style.position = 'fixed';
  img.style.left = `${left}px`;
  img.style.top = `${top}px`;
  img.style.zIndex = `21474830`;
  img.style.pointerEvents = 'none';
};

const handleResize = () => {
  sendDimensions();
  dfs(document.body, false);
};

/**
 * Starts the co-browsing session
 */
const startCoBrowse = () => {
  removeStartButton();
  addStopButton();

  if (isInitiated) {
    return;
  }
  peerDataSend({ base: location.href.match(/^(.*\/)[^\/]*$/)[1] });

  isInitiated = true;
  const body = document.body;
  dfs(body, false);

  // Append the agent cursor on the client side
  const agentCursor = document.createElement('div');
  agentCursor.setAttribute('id', 'agent_cursor');
  agentCursor.style.visibility = 'hidden';
  body.appendChild(agentCursor);

  // Append the canvas image element on the client side
  const canvasImg = document.createElement('img');
  canvasImg.setAttribute('id', 'canvasImg');
  body.appendChild(canvasImg);

  peerDataSend({ clear: true });

  // Send initial client dimension to the agent
  sendDimensions();

  // Attach relevant event listeners
  document.addEventListener('mousemove', sendMouseCoordinates);
  window.addEventListener('scroll', sendScroll);
  window.addEventListener('resize', handleResize);

  mirrorClient = new TreeMirrorClient(
    document,
    {
      initialize: function (rootId, children) {
        setRedactionDFS(children[1]);
        peerDataSend({
          f: 'initialize',
          args: [rootId, children],
        });
      },
      applyChanged: function (removed, addedOrMoved, attributes, text) {
        const applyChangedArgs = [removed, addedOrMoved, attributes, text];
        const newApplyChangedArgs = handleRedaction(applyChangedArgs);
        peerDataSend({
          f: 'applyChanged',
          args: newApplyChangedArgs,
        });
      },
    },
    null
  );

  // Send client's initial scroll details to the agent
  const verScroll =
    document.documentElement.scrollTop || document.body.scrollTop;

  peerDataSend({ scroll: verScroll });
};

const stopCoBrowse = () => {
  removeStopButton();
  addStartButton();

  isInitiated = false;

  // Stopping co-browsing session
  mirrorClient.disconnect();

  peerDataSend({ disconnect: true });

  // Removing event listeners
  document.removeEventListener('mousemove', sendMouseCoordinates);
  window.removeEventListener('scroll', sendScroll);
  window.removeEventListener('resize', sendDimensions);

  // Remove the agent cursor and canvas image elements
  document.getElementById('agent_cursor').remove();
  document.getElementById('canvasImg').remove();

  // Clearing the annotated canvas image
  client.unsubscribe(getTopic('initializeCobrowsing'));
  client.unsubscribe(getTopic('canvasToClient')); // To receive the annotated canvas image
  client.unsubscribe(getTopic('cursorToClient')); // To receive the agent's laser pointer
};

let modal = null;
const removeModal = () => {
  if (modal) {
    modal.remove();
  }
  modal = null;
};

const createModal = () => {
  if (modal) {
    removeModal();
  }

  modal = document.createElement('div');
  const modalContent = document.createElement('div');
  const closeButton = document.createElement('span');
  closeButton.innerHTML = '&times;';
  const modalText = document.createElement('p');
  modalText.innerHTML = `Your unique ID is ${clientID}.\n\n Please convey this to your agent!`;

  modalContent.appendChild(closeButton);
  modalContent.appendChild(modalText);
  modal.appendChild(modalContent);

  modalText.style.cssText = 'color: black !important';
  closeButton.style.cssText =
    'color: #aaa !important; float: right !important; font-size: 28px !important; font-weight: bold !important; cursor:pointer !important;';
  modalContent.style.cssText =
    'color: black !important; background-color: #fefefe !important; margin: 15% auto !important; padding: 10px !important; border: 1px solid #888 !important; width: 80% !important;';
  modal.style.cssText = `position: fixed !important; z-index: ${INF} !important; left: 50% !important; top: 50% !important; transform:translate(-50%, -50%) !important; width: 300px !important; height: 200px !important;  background-color: rgb(0,0,0, 0.9) !important;`;

  let body = document.body;
  body.appendChild(modal);
  closeButton.addEventListener('click', () => {
    removeModal();
  });
};

const getUniqueID = () => {
  return otpGenerator(6, {
    upperCase: false,
    specialChars: false,
    alphabets: false,
  });
};

const initiateCoBrowse = () => {
  clientID = getUniqueID();

  createModal();

  // Subscribe to the relevant topics
  client.subscribe(getTopic('initializeCobrowsing'));
  client.subscribe(getTopic('canvasToClient')); // To receive the annotated canvas image
  client.subscribe(getTopic('cursorToClient')); // To receive the agent's laser pointer

  client.onMessageArrived = function (message) {
    // message = relaxData(message);
    topic = message.destinationName;
    message = relaxData(message.payloadBytes);
    const reqMsg = JSON.parse(message.toString());
    if (topic === getTopic('initializeCobrowsing') && reqMsg === 'please') {
      removeModal();
      setTimeout(startCoBrowse, 2000);
    } else if (topic === getTopic('canvasToClient')) {
      try {
        const msg = JSON.parse(message.toString());
        if (msg === 'clearCanvasImage') {
          clearCanvasImage();
          return;
        }
        showCanvasImage(msg.imgObj);
      } catch (e) {
        console.error(e);
      }
    } else if (topic === getTopic('cursorToClient')) {
      try {
        const msg = JSON.parse(message.toString());
        if (msg === 'removeMouse') {
          document.getElementById('agent_cursor').style.visibility = 'hidden';
          return;
        }
        handleMousePositon(msg['mousePos']);
      } catch (e) {
        console.error(e);
      }
    }
  };
};

// StartCobrowse: RemoveStartButton + AddStopButton
// StopCobrowse: AddStartButton + RemoveStopButton
const addStartButton = () => {
  const btn = document.createElement('div');
  btn.id = 'start-button';
  btn.innerHTML = `<span style="text-align: center;">
    Start Cobrowsing
  </span>`;
  btn.style.cssText = `position:fixed !important; bottom:2em !important; right:2em !important; border-radius:100% !important; height: 7em !important; width: 7em !important; background-color:#1c6cfd !important; font-size:0.8em !important; cursor:pointer !important; display:flex !important; justify-content:center !important; align-items:center !important; color: white !important; z-index: ${INF} !important; `;
  document.body.append(btn);

  btn.addEventListener('click', initiateCoBrowse);
};

const removeStartButton = () => {
  document.querySelector('#start-button').remove();
};

const addStopButton = () => {
  const btn = document.createElement('div');
  btn.id = 'end-button';
  btn.innerHTML = `<span style="text-align: center;">
    Stop Cobrowsing!
  </span>`;
  btn.style.cssText = `position:fixed !important; bottom:2em !important; right:2em !important; border-radius:100% !important; height: 7em !important; width: 7em !important; background-color:#ff6060 !important; font-size:0.8em !important; cursor:pointer !important; display:flex !important; justify-content:center !important; align-items:center !important; color: white !important; z-index: ${INF} !important;`;
  document.body.append(btn);

  btn.addEventListener('click', stopCoBrowse);
};

const removeStopButton = () => {
  document.querySelector('#end-button').remove();
};
