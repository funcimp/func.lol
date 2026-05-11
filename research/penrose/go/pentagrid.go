// Package pentagrid implements the de Bruijn pentagrid construction for
// Penrose P3 tilings using math/big for arbitrary-precision arithmetic.
//
// This is a research exploration of whether Go's math/big package gives
// meaningfully better BigInt throughput than JS BigInt for the
// pentagrid enumeration hot path. See ../03-enumeration-cost.md for the
// JS numbers this is compared against.
package pentagrid

import (
	"fmt"
	"math"
	"math/big"
)

const ScaleExp = 50

var (
	Scale     *big.Int
	Scale2    *big.Int
	scaleF    float64
	sqrt5     *big.Int
	sqrtTPlus *big.Int
	sqrtTMinus *big.Int

	CosHi [5]*big.Int
	SinHi [5]*big.Int
	CosF  [5]float64
	SinF  [5]float64
)

func init() {
	Scale = new(big.Int).Exp(big.NewInt(10), big.NewInt(ScaleExp), nil)
	Scale2 = new(big.Int).Mul(Scale, Scale)
	scaleF, _ = new(big.Float).SetInt(Scale).Float64()

	// √5 · Scale
	sqrt5 = new(big.Int).Sqrt(new(big.Int).Mul(big.NewInt(5), Scale2))

	// √(10 + 2√5) · Scale and √(10 - 2√5) · Scale
	tenScale := new(big.Int).Mul(big.NewInt(10), Scale)
	twoSqrt5 := new(big.Int).Mul(big.NewInt(2), sqrt5)
	tPlus := new(big.Int).Add(tenScale, twoSqrt5)
	tMinus := new(big.Int).Sub(tenScale, twoSqrt5)
	sqrtTPlus = new(big.Int).Sqrt(new(big.Int).Mul(tPlus, Scale))
	sqrtTMinus = new(big.Int).Sqrt(new(big.Int).Mul(tMinus, Scale))

	// cos(2πj/5) values, scaled.
	four := big.NewInt(4)
	a := new(big.Int).Sub(sqrt5, Scale)              // (√5 - 1)
	a = floorDiv(a, four)                            // (√5 - 1)/4
	b := new(big.Int).Neg(new(big.Int).Add(sqrt5, Scale)) // -(√5 + 1)
	b = floorDiv(b, four)                            // -(√5 + 1)/4
	CosHi[0] = new(big.Int).Set(Scale)
	CosHi[1] = new(big.Int).Set(a)
	CosHi[2] = new(big.Int).Set(b)
	CosHi[3] = new(big.Int).Set(b)
	CosHi[4] = new(big.Int).Set(a)

	// sin(2πj/5) values, scaled.
	sp := floorDiv(sqrtTPlus, four)
	sm := floorDiv(sqrtTMinus, four)
	SinHi[0] = big.NewInt(0)
	SinHi[1] = new(big.Int).Set(sp)
	SinHi[2] = new(big.Int).Set(sm)
	SinHi[3] = new(big.Int).Neg(sm)
	SinHi[4] = new(big.Int).Neg(sp)

	// Float64 versions.
	for j := 0; j < 5; j++ {
		f, _ := new(big.Float).SetInt(CosHi[j]).Float64()
		CosF[j] = f / scaleF
		f2, _ := new(big.Float).SetInt(SinHi[j]).Float64()
		SinF[j] = f2 / scaleF
	}
}

// floorDiv returns floor(n / d) for d != 0. math/big's Quo truncates
// toward zero; we want floor.
func floorDiv(n, d *big.Int) *big.Int {
	q, r := new(big.Int).QuoRem(n, d, new(big.Int))
	if r.Sign() != 0 && (n.Sign() < 0) != (d.Sign() < 0) {
		q.Sub(q, big.NewInt(1))
	}
	return q
}

// GammaFromSeed mirrors the JS FNV-1a / mulberry-ish derivation in
// research/penrose/03-enumeration-cost.ts so direct comparisons remain
// apples-to-apples.
func GammaFromSeed(seed string) ([5]*big.Int, [5]float64) {
	var h uint32 = 2166136261
	for _, c := range seed {
		h ^= uint32(c)
		h *= 16777619
	}
	var raw [5]*big.Int
	for i := 0; i < 5; i++ {
		h ^= uint32(i + 1)
		h *= 16777619
		// raw[i] = (h * Scale) / 2^32 - Scale/2
		hb := new(big.Int).SetUint64(uint64(h))
		num := new(big.Int).Mul(hb, Scale)
		denom := new(big.Int).Lsh(big.NewInt(1), 32)
		raw[i] = new(big.Int).Quo(num, denom)
		raw[i].Sub(raw[i], new(big.Int).Quo(Scale, big.NewInt(2)))
	}
	sum := big.NewInt(0)
	for i := 0; i < 5; i++ {
		sum.Add(sum, raw[i])
	}
	shift := new(big.Int).Quo(sum, big.NewInt(5))
	var exact [5]*big.Int
	var float [5]float64
	for i := 0; i < 5; i++ {
		exact[i] = new(big.Int).Sub(raw[i], shift)
		f, _ := new(big.Float).SetInt(exact[i]).Float64()
		float[i] = f / scaleF
	}
	return exact, float
}

// Rect is in unscaled world units (small ints near origin for the
// benchmark). Internally it is rescaled to Scale for BigInt math.
type Rect struct {
	X0, Y0, X1, Y1 int64
}

// EnumerateExact returns the count of unique tiles with vertices in the
// rect, computed in BigInt-exact math.
func EnumerateExact(gamma [5]*big.Int, rect Rect) int {
	seen := make(map[string]struct{}, 2048)

	gammaF := [5]float64{}
	for j := 0; j < 5; j++ {
		f, _ := new(big.Float).SetInt(gamma[j]).Float64()
		gammaF[j] = f / scaleF
	}

	rectX0Big := new(big.Int).Mul(big.NewInt(rect.X0), Scale)
	rectY0Big := new(big.Int).Mul(big.NewInt(rect.Y0), Scale)
	rectX1Big := new(big.Int).Mul(big.NewInt(rect.X1), Scale)
	rectY1Big := new(big.Int).Mul(big.NewInt(rect.Y1), Scale)

	tmp := new(big.Int)
	prod1 := new(big.Int)
	prod2 := new(big.Int)
	num := new(big.Int)
	aj := new(big.Int)
	ak := new(big.Int)
	pxNum := new(big.Int)
	pyNum := new(big.Int)
	px := new(big.Int)
	py := new(big.Int)
	det := new(big.Int)

	tup := [5]*big.Int{}
	for i := range tup {
		tup[i] = new(big.Int)
	}

	for j := 0; j < 4; j++ {
		for k := j + 1; k < 5; k++ {
			ejx, ejy := CosHi[j], SinHi[j]
			ekx, eky := CosHi[k], SinHi[k]
			ejxF, ejyF := CosF[j], SinF[j]
			ekxF, ekyF := CosF[k], SinF[k]

			det.Mul(ejx, eky)
			tmp.Mul(ejy, ekx)
			det.Sub(det, tmp)
			if det.Sign() == 0 {
				continue
			}

			rx0, rx1 := float64(rect.X0), float64(rect.X1)
			ry0, ry1 := float64(rect.Y0), float64(rect.Y1)
			pj0 := rx0*ejxF + ry0*ejyF
			pj1 := rx1*ejxF + ry0*ejyF
			pj2 := rx0*ejxF + ry1*ejyF
			pj3 := rx1*ejxF + ry1*ejyF
			pk0 := rx0*ekxF + ry0*ekyF
			pk1 := rx1*ekxF + ry0*ekyF
			pk2 := rx0*ekxF + ry1*ekyF
			pk3 := rx1*ekxF + ry1*ekyF

			kjMin := int64(math.Floor(minF(pj0, pj1, pj2, pj3)+gammaF[j])) - 1
			kjMax := int64(math.Ceil(maxF(pj0, pj1, pj2, pj3)+gammaF[j])) + 1
			kkMin := int64(math.Floor(minF(pk0, pk1, pk2, pk3)+gammaF[k])) - 1
			kkMax := int64(math.Ceil(maxF(pk0, pk1, pk2, pk3)+gammaF[k])) + 1

			for kjN := kjMin; kjN <= kjMax; kjN++ {
				kj := big.NewInt(kjN)
				aj.Mul(kj, Scale)
				aj.Sub(aj, gamma[j])
				for kkN := kkMin; kkN <= kkMax; kkN++ {
					kk := big.NewInt(kkN)
					ak.Mul(kk, Scale)
					ak.Sub(ak, gamma[k])

					// pxNum = (eky*aj - ejy*ak) * Scale
					prod1.Mul(eky, aj)
					prod2.Mul(ejy, ak)
					pxNum.Sub(prod1, prod2)
					pxNum.Mul(pxNum, Scale)

					// pyNum = (ejx*ak - ekx*aj) * Scale
					prod1.Mul(ejx, ak)
					prod2.Mul(ekx, aj)
					pyNum.Sub(prod1, prod2)
					pyNum.Mul(pyNum, Scale)

					px.Set(floorDivInto(px, pxNum, det))
					py.Set(floorDivInto(py, pyNum, det))

					if px.Cmp(rectX0Big) < 0 || px.Cmp(rectX1Big) > 0 ||
						py.Cmp(rectY0Big) < 0 || py.Cmp(rectY1Big) > 0 {
						continue
					}

					for l := 0; l < 5; l++ {
						if l == j {
							tup[l].Set(kj)
						} else if l == k {
							tup[l].Set(kk)
						} else {
							// floor((px*COS_HI[l] + py*SIN_HI[l] + gamma[l]*Scale) / Scale²)
							prod1.Mul(px, CosHi[l])
							prod2.Mul(py, SinHi[l])
							num.Add(prod1, prod2)
							prod1.Mul(gamma[l], Scale)
							num.Add(num, prod1)
							tup[l].Set(floorDivInto(tup[l], num, Scale2))
						}
					}
					key := fmt.Sprintf("%s,%s,%s,%s,%s", tup[0], tup[1], tup[2], tup[3], tup[4])
					seen[key] = struct{}{}
				}
			}
		}
	}
	return len(seen)
}

// floorDivInto writes floor(n / d) into dst and returns it.
func floorDivInto(dst, n, d *big.Int) *big.Int {
	dst.QuoRem(n, d, scratch)
	if scratch.Sign() != 0 && (n.Sign() < 0) != (d.Sign() < 0) {
		dst.Sub(dst, oneBig)
	}
	return dst
}

var (
	scratch = new(big.Int)
	oneBig  = big.NewInt(1)
)

func minF(a, b, c, d float64) float64 {
	return math.Min(math.Min(a, b), math.Min(c, d))
}
func maxF(a, b, c, d float64) float64 {
	return math.Max(math.Max(a, b), math.Max(c, d))
}

// Anchor holds an exact world position plus precomputed per-direction
// projections. The anchor's integer projection (NProj) is BigInt;
// the fractional remainder (FProj) is Float64 in [0, 1) and feeds the
// per-frame enumeration loop as γ_eff. Per-tile absolute coords are
// built by adding NProj[j] to the offset-frame floor result.
type Anchor struct {
	X, Y  *big.Int
	NProj [5]*big.Int
	FProj [5]float64
}

// MakeAnchor computes the projections for a given world position.
// Call once per re-anchor; cheap to throw away when the offset grows
// past the precision threshold and a new anchor is picked.
func MakeAnchor(x, y *big.Int, gamma [5]*big.Int) *Anchor {
	a := &Anchor{X: new(big.Int).Set(x), Y: new(big.Int).Set(y)}
	scale2F, _ := new(big.Float).SetInt(Scale2).Float64()
	for j := 0; j < 5; j++ {
		proj := new(big.Int).Mul(x, CosHi[j])
		t := new(big.Int).Mul(y, SinHi[j])
		proj.Add(proj, t)
		t.Mul(gamma[j], Scale)
		proj.Add(proj, t)

		n := floorDiv(proj, Scale2)
		remainder := new(big.Int).Mul(n, Scale2)
		remainder.Sub(proj, remainder)
		// remainder is in [0, Scale²); convert to Float64 in [0, 1).
		rf, _ := new(big.Float).SetInt(remainder).Float64()
		a.NProj[j] = n
		a.FProj[j] = rf / scale2F
	}
	return a
}

// EnumerateAnchored counts unique tiles in the offset-relative rect.
// The inner loop is pure Float64 with γ_eff = anchor.FProj; for each
// found tile, the absolute pentagrid coord is anchor.NProj[j] + the
// Float64-derived offset coord. Dedup key is the absolute 5-tuple, to
// match the JS Q4 benchmark for fair comparison.
func EnumerateAnchored(anchor *Anchor, rect Rect) int {
	seen := make(map[string]struct{}, 2048)
	gamma := anchor.FProj

	rx0, rx1 := float64(rect.X0), float64(rect.X1)
	ry0, ry1 := float64(rect.Y0), float64(rect.Y1)

	tmpAbs := [5]*big.Int{}
	for i := range tmpAbs {
		tmpAbs[i] = new(big.Int)
	}

	for j := 0; j < 4; j++ {
		for k := j + 1; k < 5; k++ {
			ejx, ejy := CosF[j], SinF[j]
			ekx, eky := CosF[k], SinF[k]
			det := ejx*eky - ejy*ekx
			if math.Abs(det) < 1e-12 {
				continue
			}
			invDet := 1 / det

			pj0 := rx0*ejx + ry0*ejy
			pj1 := rx1*ejx + ry0*ejy
			pj2 := rx0*ejx + ry1*ejy
			pj3 := rx1*ejx + ry1*ejy
			pk0 := rx0*ekx + ry0*eky
			pk1 := rx1*ekx + ry0*eky
			pk2 := rx0*ekx + ry1*eky
			pk3 := rx1*ekx + ry1*eky

			kjMin := int64(math.Floor(minF(pj0, pj1, pj2, pj3)+gamma[j])) - 1
			kjMax := int64(math.Ceil(maxF(pj0, pj1, pj2, pj3)+gamma[j])) + 1
			kkMin := int64(math.Floor(minF(pk0, pk1, pk2, pk3)+gamma[k])) - 1
			kkMax := int64(math.Ceil(maxF(pk0, pk1, pk2, pk3)+gamma[k])) + 1

			for kj := kjMin; kj <= kjMax; kj++ {
				aj := float64(kj) - gamma[j]
				for kk := kkMin; kk <= kkMax; kk++ {
					ak := float64(kk) - gamma[k]
					px := (eky*aj - ejy*ak) * invDet
					py := (-ekx*aj + ejx*ak) * invDet
					if px < rx0 || px > rx1 || py < ry0 || py > ry1 {
						continue
					}
					var o [5]int64
					for l := 0; l < 5; l++ {
						switch l {
						case j:
							o[l] = kj
						case k:
							o[l] = kk
						default:
							o[l] = int64(math.Floor(px*CosF[l] + py*SinF[l] + gamma[l]))
						}
					}
					for l := 0; l < 5; l++ {
						tmpAbs[l].Add(anchor.NProj[l], big.NewInt(o[l]))
					}
					key := fmt.Sprintf("%s,%s,%s,%s,%s", tmpAbs[0], tmpAbs[1], tmpAbs[2], tmpAbs[3], tmpAbs[4])
					seen[key] = struct{}{}
				}
			}
		}
	}
	return len(seen)
}
