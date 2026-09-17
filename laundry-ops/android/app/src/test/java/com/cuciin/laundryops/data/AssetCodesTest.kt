package com.cuciin.laundryops.data

import org.junit.Assert.assertEquals
import org.junit.Test

class AssetCodesTest {
    @Test fun firstAssetOfTypeStartsAtOne() {
        assertEquals("BNY-MC-001", AssetCodes.next("BNY", "MC", emptyList()))
    }

    @Test fun nextSequenceFollowsHighestExistingCode() {
        val codes = listOf("BNY-MC-001", "BNY-MC-002")
        assertEquals("BNY-MC-003", AssetCodes.next("BNY", "MC", codes))
    }

    @Test fun deletingAnAssetDoesNotReuseItsCode() {
        // Aset nomor 2 dihapus, jadi yang tersisa hanya 001 dan 003.
        val codes = listOf("BNY-MC-001", "BNY-MC-003")
        assertEquals("BNY-MC-004", AssetCodes.next("BNY", "MC", codes))
    }

    @Test fun otherBranchesAndTypesDoNotShiftTheSequence() {
        val codes = listOf("SHL-MC-009", "BNY-ST-004", "BNY-MC-001")
        assertEquals("BNY-MC-002", AssetCodes.next("BNY", "MC", codes))
    }

    @Test fun blankBranchOrTypeFallsBackInsteadOfProducingAnEmptyPrefix() {
        assertEquals("CAB-AS-001", AssetCodes.next("", "", emptyList()))
    }

    @Test fun branchAndTypeCodesAreNormalized() {
        assertEquals("BNY-MC-001", AssetCodes.next(" bny ", "mc", emptyList()))
    }
}
