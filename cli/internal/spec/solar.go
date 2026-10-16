package spec

// Solar events with the NOAA algorithm, ported line for line from Python's
// astral 3.2 (astral/sun.py), which the reference implementation uses. An
// observer at sea level; dawn and dusk are civil twilight (6 degrees).

import (
	"math"
	"time"
)

const sunApparentRadius = 32.0 / (60.0 * 2.0)

type observer struct {
	lat, lon float64
	tz       *time.Location
}

// solarWall is the wall time of `event` on the wall day `day`, or its
// fallback when there's no location or the event doesn't happen that day.
func solarWall(event string, day time.Time, loc *Location) time.Time {
	fallback := day.Add(time.Duration(Fallbacks[event]) * time.Minute)
	if event == "midnight" || loc == nil {
		return fallback
	}
	tz, err := time.LoadLocation(loc.Timezone)
	if err != nil {
		panic(err) // checked by Active
	}
	o := observer{loc.Latitude, loc.Longitude, tz}
	var t time.Time
	var ok bool
	switch event {
	case "noon":
		t, ok = noon(o, day), true
	case "dawn":
		t, ok = transitOn(o, day, 96, true)
	case "sunrise":
		t, ok = transitOn(o, day, 90+sunApparentRadius, true)
	case "sunset":
		t, ok = transitOn(o, day, 90+sunApparentRadius, false)
	case "dusk":
		t, ok = transitOn(o, day, 96, false)
	}
	if !ok {
		return fallback
	}
	// Like the reference: the event's local time of day, on `day`.
	h, m, s := t.In(tz).Clock()
	return day.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute +
		time.Duration(s)*time.Second + time.Duration(t.Nanosecond()))
}

// transitOn is astral's dawn/sunrise/sunset/dusk: the transit on `day` in the
// observer's time zone, retrying the neighbouring UTC date when the first
// answer lands on another local date. ok is false when there is none.
func transitOn(o observer, day time.Time, zenith float64, rising bool) (time.Time, bool) {
	t, ok := timeOfTransit(o, day, zenith, rising)
	if !ok {
		return t, false
	}
	if got := localDate(t, o.tz); !got.Equal(day) {
		next := day.AddDate(0, 0, -1)
		if got.Before(day) {
			next = day.AddDate(0, 0, 1)
		}
		if t, ok = timeOfTransit(o, next, zenith, rising); !ok || !localDate(t, o.tz).Equal(day) {
			return t, false
		}
	}
	return t, true
}

func localDate(t time.Time, tz *time.Location) time.Time {
	return wallDay(Wall(t.In(tz)))
}

// timeOfTransit is the UTC instant the sun crosses `zenith` on `date`.
func timeOfTransit(o observer, date time.Time, zenith float64, rising bool) (time.Time, bool) {
	lat := math.Max(-89.8, math.Min(89.8, o.lat))
	refraction := refractionAtZenith(zenith)
	jd := julianDay(date)
	adjustment, timeUTC := 0.0, 0.0
	for range 2 {
		jc := (jd + adjustment - 2451545.0) / 36525.0
		ha := hourAngle(lat, sunDeclination(jc), zenith+refraction, rising)
		if math.IsNaN(ha) { // astral: "math domain error", the sun never gets there
			return time.Time{}, false
		}
		delta := -o.lon - degrees(ha)
		offset := delta*4.0 - eqOfTime(jc)
		if offset < -720.0 {
			offset += 1440
		}
		timeUTC = 720.0 + offset
		adjustment = timeUTC / 1440.0
	}
	return date.Add(minutes(timeUTC)), true
}

// noon is solar noon on `date`, as astral computes it (truncated to the second).
func noon(o observer, date time.Time) time.Time {
	jc := (julianDay(date) - 2451545.0) / 36525.0
	timeUTC := (720.0 - 4*o.lon - eqOfTime(jc)) / 60.0
	hour := int(timeUTC)
	minute := int((timeUTC - float64(hour)) * 60)
	second := int(((timeUTC-float64(hour))*60 - float64(minute)) * 60)
	if second > 59 {
		second -= 60
		minute++
	} else if second < 0 {
		second += 60
		minute--
	}
	if minute > 59 {
		minute -= 60
		hour++
	} else if minute < 0 {
		minute += 60
		hour--
	}
	if hour > 23 {
		hour -= 24
		date = date.AddDate(0, 0, 1)
	} else if hour < 0 {
		hour += 24
		date = date.AddDate(0, 0, -1)
	}
	return time.Date(date.Year(), date.Month(), date.Day(), hour, minute, second, 0, time.UTC)
}

// minutes is astral's minutes_to_timedelta: truncated to the microsecond.
func minutes(m float64) time.Duration {
	d := float64(int(m / 1440))
	secs := (m - d*1440) * 60
	s := float64(int(secs))
	us := int64((secs - s) * 1e6)
	return time.Duration(d)*24*time.Hour + time.Duration(s)*time.Second + time.Duration(us)*time.Microsecond
}

func julianDay(date time.Time) float64 {
	year, month, day := date.Year(), int(date.Month()), date.Day()
	if month <= 2 {
		year--
		month += 12
	}
	a := year / 100
	b := 2 - a + a/4
	return float64(int(365.25*float64(year+4716))) + float64(int(30.6001*float64(month+1))) +
		float64(day) + float64(b) - 1524.5
}

func radians(d float64) float64 { return d * math.Pi / 180 }
func degrees(r float64) float64 { return r * 180 / math.Pi }

func geomMeanLongSun(jc float64) float64 {
	l0 := math.Mod(280.46646+jc*(36000.76983+0.0003032*jc), 360.0)
	if l0 < 0 { // Python's % takes the divisor's sign
		l0 += 360
	}
	return l0
}

func geomMeanAnomalySun(jc float64) float64 {
	return 357.52911 + jc*(35999.05029-0.0001537*jc)
}

func eccentricityEarthOrbit(jc float64) float64 {
	return 0.016708634 - jc*(0.000042037+0.0000001267*jc)
}

func sunEqOfCenter(jc float64) float64 {
	mrad := radians(geomMeanAnomalySun(jc))
	return math.Sin(mrad)*(1.914602-jc*(0.004817+0.000014*jc)) +
		math.Sin(mrad+mrad)*(0.019993-0.000101*jc) +
		math.Sin(mrad+mrad+mrad)*0.000289
}

func sunApparentLong(jc float64) float64 {
	trueLong := geomMeanLongSun(jc) + sunEqOfCenter(jc)
	omega := 125.04 - 1934.136*jc
	return trueLong - 0.00569 - 0.00478*math.Sin(radians(omega))
}

func obliquityCorrection(jc float64) float64 {
	seconds := 21.448 - jc*(46.815+jc*(0.00059-jc*0.001813))
	e0 := 23.0 + (26.0+seconds/60.0)/60.0
	omega := 125.04 - 1934.136*jc
	return e0 + 0.00256*math.Cos(radians(omega))
}

func sunDeclination(jc float64) float64 {
	return degrees(math.Asin(math.Sin(radians(obliquityCorrection(jc))) * math.Sin(radians(sunApparentLong(jc)))))
}

func eqOfTime(jc float64) float64 {
	l0 := geomMeanLongSun(jc)
	e := eccentricityEarthOrbit(jc)
	m := geomMeanAnomalySun(jc)
	y := math.Tan(radians(obliquityCorrection(jc)) / 2.0)
	y *= y
	sin2l0 := math.Sin(2.0 * radians(l0))
	sinm := math.Sin(radians(m))
	cos2l0 := math.Cos(2.0 * radians(l0))
	sin4l0 := math.Sin(4.0 * radians(l0))
	sin2m := math.Sin(2.0 * radians(m))
	etime := y*sin2l0 - 2.0*e*sinm + 4.0*e*y*sinm*cos2l0 - 0.5*y*y*sin4l0 - 1.25*e*e*sin2m
	return degrees(etime) * 4.0
}

func hourAngle(lat, declination, zenith float64, rising bool) float64 {
	latR, decR := radians(lat), radians(declination)
	h := (math.Cos(radians(zenith)) - math.Sin(latR)*math.Sin(decR)) / (math.Cos(latR) * math.Cos(decR))
	ha := math.Acos(h) // NaN when |h| > 1
	if !rising {
		ha = -ha
	}
	return ha
}

func refractionAtZenith(zenith float64) float64 {
	elevation := 90 - zenith
	if elevation >= 85.0 {
		return 0
	}
	te := math.Tan(radians(elevation))
	var correction float64
	switch {
	case elevation > 5.0:
		correction = 58.1/te - 0.07/(te*te*te) + 0.000086/(te*te*te*te*te)
	case elevation > -0.575:
		correction = 1735.0 + elevation*(-518.2+elevation*(103.4+elevation*(-12.79+elevation*0.711)))
	default:
		correction = -20.774 / te
	}
	return correction / 3600.0
}
