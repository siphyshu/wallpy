//go:build ignore

// Builds cities.tsv.gz, the offline city list `wallpy location` searches,
// from GeoNames (https://www.geonames.org, CC BY 4.0):
//
//	cd internal/geo && go run gen/main.go <dir with cities15000.txt, admin1CodesASCII.txt, countryInfo.txt>
//
// Every city over 15,000 people, with the Latin-script names it's also
// known by (Bangalore for Bengaluru), so searches find the name people use.
package main

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func readTSV(path string, fn func([]string)) {
	f, err := os.Open(path)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 1<<24)
	for sc.Scan() {
		if line := sc.Text(); line != "" && line[0] != '#' {
			fn(strings.Split(line, "\t"))
		}
	}
}

// latin keeps names people write: ASCII letters, spaces, dots, hyphens and
// apostrophes, at least 3 letters, capitalised but not all caps.
func latin(s string) bool {
	if len(s) < 3 || strings.ToUpper(s) == s || strings.ToLower(s) == s {
		return false // codes like "BLR", and lowercase machine romanizations
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r == ' ' || r == '-' || r == '\'' || r == '.') {
			return false
		}
	}
	return true
}

func main() {
	dir := os.Args[1]
	countries := map[string]string{}
	readTSV(filepath.Join(dir, "countryInfo.txt"), func(f []string) { countries[f[0]] = f[4] })
	admins := map[string]string{}
	readTSV(filepath.Join(dir, "admin1CodesASCII.txt"), func(f []string) { admins[f[0]] = f[1] }) // the proper name, accents kept

	type city struct {
		line string
		pop  int
	}
	var cities []city
	readTSV(filepath.Join(dir, "cities15000.txt"), func(f []string) {
		name, ascii := f[1], f[2]
		seen := map[string]bool{strings.ToLower(name): true}
		var aliases []string
		for _, a := range append([]string{ascii}, strings.Split(f[3], ",")...) {
			if latin(a) && !seen[strings.ToLower(a)] {
				seen[strings.ToLower(a)] = true
				aliases = append(aliases, a)
			}
		}
		var pop int
		fmt.Sscan(f[14], &pop)
		admin := admins[f[8]+"."+f[10]]
		cities = append(cities, city{strings.Join([]string{
			name, strings.Join(aliases, ";"), admin, countries[f[8]], f[8], f[4], f[5], f[17], f[14],
		}, "\t"), pop})
	})
	sort.Slice(cities, func(i, j int) bool { return cities[i].pop > cities[j].pop })

	out, err := os.Create("cities.tsv.gz")
	if err != nil {
		panic(err)
	}
	gz, _ := gzip.NewWriterLevel(out, gzip.BestCompression)
	fmt.Fprintln(gz, "# name\taliases\tadmin1\tcountry\tcc\tlat\tlon\ttimezone\tpopulation. From GeoNames (geonames.org), CC BY 4.0.")
	for _, c := range cities {
		fmt.Fprintln(gz, c.line)
	}
	gz.Close()
	out.Close()
	info, _ := os.Stat("cities.tsv.gz")
	fmt.Printf("%d cities, %d KB\n", len(cities), info.Size()/1024)
}
