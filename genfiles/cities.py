import os
import csv
import json
from collections import defaultdict


def main() -> None:
    dirname = os.path.dirname(__file__)

    # got the csv from https://simplemaps.com/data/world-cities (free one)
    data = defaultdict(list)
    with open(os.path.join(dirname, "input/cities.csv"), newline="") as csvfile:
        for row in [c := csv.reader(csvfile, delimiter=","), next(c), c][-1]:
            city, lat, lng, country, *_ = row
            p = int(_[4]) if _[4] else 0
            if p > 5000:  # are you even real if less than that?
                data[country].append(
                    {"city": city, "lat": float(lat), "lng": float(lng), "p": p}
                )

    for country in data:
        data[country] = sorted(data[country], key=lambda city: city["p"], reverse=True)[
            :3
        ]

    with open(os.path.join(dirname, "output/cities.json"), "w") as f:
        json.dump(data, f, indent=4)


if __name__ == "__main__":
    main()
