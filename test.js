"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var simplex_noise_1 = require("simplex-noise");
var noise2D = (0, simplex_noise_1.createNoise2D)();
var size = 16;
var grid = __spreadArray([], Array(size), true).map(function (_) { return Array(size); });
var offset = Math.random() * 1000;
for (var i = 0; i < size; i++) {
    for (var j = 0; j < size; j++) {
        var n = Math.round(noise2D(i + offset, j - offset) * 100 + 100);
        if (n < 90) {
            grid[i][j] = "#";
        }
        else if ((n >= 90) && (n <= 110)) {
            grid[i][j] = "/";
        }
        else {
            grid[i][j] = ".";
        }
        process.stdout.write(grid[i][j] + " ");
    }
    process.stdout.write("\n");
}
