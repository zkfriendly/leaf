import CompPoly.Fields.BN254.Basic

-- abbreviation as F
abbrev F:= BN254.ScalarField
#check F

-- define a vector
abbrev FieldVec (n : Nat) := Fin n -> F
#check FieldVec 3

def innerProduct {n: Nat} (a b: FieldVec n) : F :=
    ∑i, a i * b i
