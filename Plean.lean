import CompPoly.Fields.BN254.Basic

-- abbreviation as F
abbrev F:= BN254.ScalarField
#check F

-- define a vector
abbrev FieldVec (n : Nat) := Fin n -> F
#check FieldVec 3

def innerProduct {n: Nat} (a b: FieldVec n) : F :=
    ∑i, a i * b i

-- the claim will say: "The inner product of the committed vector and these weights equals this value."
structure InnerProductClaim (n: Nat) where
    weights: FieldVec n
    value: F
#check InnerProductClaim 3

def InnerProductClaim.Holds {n: Nat}
    (witness: FieldVec n) (claim: InnerProductClaim n) : Prop :=
        claim.value = innerProduct witness claim.weights

theorem computedClaim_holds {n: Nat} (witness weights: FieldVec n) :
    (InnerProductClaim.mk weights (innerProduct witness weights)).Holds witness := by rfl

-- PCS
structure PCS (n : Nat) where
  Commitment : Type -- the public value that represents the committed vector.
  ProverState : Type -- private data the prover keeps to produce openings.
  OpeningProof : Type -- public evidence that the verifier checks for a claim.

  CommitRandomness : Type
  OpeningRandomness : Type

  commit : FieldVec n → CommitRandomness → Commitment × ProverState
  openClaim: ProverState × InnerProductClaim n × OpeningRandomness -> Option OpeningProof
  verify: Commitment × InnerProductClaim n × OpeningProof -> Bool

def PCS.HonestAccepts {n : Nat} (pcs : PCS n)
    (witness weights : FieldVec n)
    (rc : pcs.CommitRandomness) (ro : pcs.OpeningRandomness) : Prop :=
  let (commitment, state) := pcs.commit witness rc
  let claim := InnerProductClaim.mk weights (innerProduct weights witness)
  match pcs.openClaim (state, claim, ro) with
    | none => False
    | some proof => pcs.verify (commitment, claim, proof) = true
