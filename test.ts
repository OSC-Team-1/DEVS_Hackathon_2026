import { createNoise2D } from "simplex-noise";

const noise2D = createNoise2D();

const size = 16;
const grid = [...Array(size)].map((_) => Array(size));

const offset = Math.random() * 1000;

for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
        const n = Math.round(noise2D(i + offset, j - offset) * 100 + 100);

        if (n < 90) {
            grid[i][j] = "#";
        } else if ((n >= 90) && (n <= 110)) {
            grid[i][j] = "/";
        } else {
            grid[i][j] = ".";
        }
        process.stdout.write(grid[i][j] + " ");
    }
    process.stdout.write("\n");
}

