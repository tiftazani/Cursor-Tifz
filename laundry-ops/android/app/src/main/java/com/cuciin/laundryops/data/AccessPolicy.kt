package com.cuciin.laundryops.data

/**
 * Penentu izin akses.
 *
 * Dipisahkan dari store supaya dapat diuji tanpa Android dan supaya aturannya hanya ada di
 * satu tempat: layar Kontrol Akses Role menampilkan hal yang sama dengan yang diperiksa di sini.
 *
 * Urutan penentuan izin:
 * 1. Role bawaan Owner selalu memiliki seluruh modul dan fungsi.
 * 2. Role yang melekat pada pengguna menentukan modul dan fungsi yang diizinkan.
 * 3. Kebijakan per pengguna, bila ada, mempersempit hasil role (bukan memperluasnya).
 */
object AccessPolicy {
    fun rolesFor(roles: List<AccessRole>): List<AccessRole> =
        if (roles.isEmpty()) AccessCatalog.builtInRoles() else roles

    fun roleById(roles: List<AccessRole>, id: String): AccessRole? = rolesFor(roles).firstOrNull { it.id == id }

    /**
     * Role yang benar-benar berlaku untuk seorang pengguna.
     *
     * Bila pengguna belum punya role akses, dipakai role bawaan sesuai peran lamanya agar
     * data lama tetap berjalan tanpa perubahan.
     */
    fun effectiveRole(staff: Staff?, roles: List<AccessRole>): AccessRole {
        val catalog = rolesFor(roles)
        val explicit = staff?.accessRoleId?.takeIf { it.isNotBlank() }?.let { id -> catalog.firstOrNull { it.id == id } }
        if (explicit != null) return explicit
        val legacyId = staff?.role?.let { AccessCatalog.builtInIdFor(it) }
        return catalog.firstOrNull { it.id == legacyId } ?: catalog.first()
    }

    /** Owner selalu penuh, walaupun daftar role belum tersinkron. */
    fun isOwner(role: Role): Boolean = role == Role.Owner

    /**
     * Modul dan fungsi yang berlaku untuk seorang pengguna: hasil role, lalu dipersempit
     * oleh kebijakan per pengguna bila ada.
     */
    fun grants(staff: Staff?, roles: List<AccessRole>, policy: UserAccessPolicy?): Pair<Set<String>, Set<String>> {
        if (staff != null && isOwner(staff.role)) return AccessCatalog.moduleKeys to AccessCatalog.allFunctionKeys()
        val role = effectiveRole(staff, roles)
        var modules = role.modules
        var functions = role.functions
        if (policy != null) {
            // Kebijakan pengguna hanya boleh mengurangi, tidak menambah, hak dari role.
            modules = modules.intersect(policy.modules)
            functions = functions.intersect(policy.functions)
        }
        return AccessCatalog.sanitize(modules, functions)
    }

    fun can(
        staff: Staff?,
        roles: List<AccessRole>,
        policy: UserAccessPolicy?,
        module: String,
        function: String? = null,
    ): Boolean {
        if (staff == null) return false
        val (modules, functions) = grants(staff, roles, policy)
        if (module !in modules) return false
        return function == null || function in functions
    }

    /** Jumlah pengguna yang melekat pada tiap role, dipakai di layar daftar role. */
    fun memberCount(staff: List<Staff>, roleId: String): Int = staff.count { staffMember ->
        staffMember.accessRoleId == roleId || (staffMember.accessRoleId.isBlank() && AccessCatalog.builtInIdFor(staffMember.role) == roleId)
    }
}
