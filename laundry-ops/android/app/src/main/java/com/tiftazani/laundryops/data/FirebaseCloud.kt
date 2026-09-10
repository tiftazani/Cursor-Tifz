package com.tiftazani.laundryops.data

import android.app.Application
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions

/**
 * Firebase Auth + Firestore. Nyala otomatis kalau `google-services.json` ada
 * (plugin Gradle + [FirebaseApp.initializeApp]). Tanpa file itu, app tetap
 * jalan pakai data lokal.
 */
object FirebaseCloud {
    private const val TAG = "CuciinFirebase"
    private val main = Handler(Looper.getMainLooper())
    var enabled: Boolean = false
        private set

    private fun ui(block: () -> Unit) {
        main.post(block)
    }

    fun init(app: Application) {
        enabled = try {
            if (FirebaseApp.getApps(app).isEmpty()) {
                FirebaseApp.initializeApp(app) != null
            } else {
                true
            }
        } catch (e: Exception) {
            Log.i(TAG, "Firebase off (lokal): ${e.message}")
            false
        }
        Log.i(TAG, "enabled=$enabled")
    }

    fun listenSnapshot(onSnap: (Snapshot) -> Unit) {
        if (!enabled) return
        FirebaseFirestore.getInstance().collection("ops").document("cuciin")
            .addSnapshotListener { snap, err ->
                if (err != null) {
                    Log.w(TAG, "listen", err)
                    return@addSnapshotListener
                }
                val json = snap?.getString("json") ?: return@addSnapshotListener
                try {
                    val parsed = LocalJson.json.decodeFromString(Snapshot.serializer(), json)
                    ui { onSnap(parsed) }
                } catch (e: Exception) {
                    Log.w(TAG, "decode", e)
                }
            }
    }

    fun pushSnapshot(s: Snapshot) {
        if (!enabled) return
        val json = LocalJson.json.encodeToString(Snapshot.serializer(), s)
        FirebaseFirestore.getInstance().collection("ops").document("cuciin")
            .set(hashMapOf("json" to json, "updatedAt" to s.updatedAt), SetOptions.merge())
    }

    fun signIn(email: String, password: String, onDone: (ok: Boolean, pending: Boolean, msg: String) -> Unit) {
        if (!enabled) {
            ui { onDone(false, false, "Firebase belum dikonfigurasi") }
            return
        }
        FirebaseAuth.getInstance()
            .signInWithEmailAndPassword(email.trim(), password)
            .addOnSuccessListener { res ->
                val uid = res.user?.uid ?: return@addOnSuccessListener ui { onDone(false, false, "uid kosong") }
                FirebaseFirestore.getInstance().collection("users").document(uid).get()
                    .addOnSuccessListener { snap ->
                        val approved = snap.getBoolean("approved") ?: false
                        val name = snap.getString("name") ?: email
                        val role = when (snap.getString("role")) {
                            "Owner" -> Role.Owner
                            "Supervisor" -> Role.Supervisor
                            else -> Role.Kasir
                        }
                        val branches = (snap.get("branchIds") as? List<*>)?.mapNotNull { it as? String }.orEmpty()
                            .ifEmpty { listOf("melati") }
                        if (!approved) {
                            CuciinStore.pendingName.value = name
                            ui { onDone(false, true, "Nunggu Owner") }
                            return@addOnSuccessListener
                        }
                        CuciinStore.session.value = Session(role, name, email.trim(), branches.first())
                        CuciinStore.viewBranch.value = if (role == Role.Owner) "all" else branches.first()
                        CuciinStore.bumpPublic()
                        pullAll()
                        ui { onDone(true, false, "ok") }
                    }
                    .addOnFailureListener { e -> ui { onDone(false, false, e.message ?: "Firestore gagal") } }
            }
            .addOnFailureListener { e -> ui { onDone(false, false, e.message ?: "Auth gagal") } }
    }

    fun register(name: String, email: String, password: String, role: Role, branchId: String, onDone: (String) -> Unit) {
        if (!enabled) {
            CuciinStore.register(name, email, role, branchId, password)
            ui { onDone("pending-local") }
            return
        }
        FirebaseAuth.getInstance()
            .createUserWithEmailAndPassword(email.trim(), password)
            .addOnSuccessListener { res ->
                val uid = res.user?.uid ?: return@addOnSuccessListener
                val data = hashMapOf(
                    "name" to name,
                    "email" to email.trim(),
                    "role" to role.name,
                    "branchIds" to listOf(branchId),
                    "approved" to false,
                )
                FirebaseFirestore.getInstance().collection("users").document(uid).set(data)
                    .addOnSuccessListener {
                        CuciinStore.register(name, email, role, branchId, password)
                        ui { onDone("pending") }
                    }
                    .addOnFailureListener { e -> ui { onDone(e.message ?: "gagal tulis user") } }
            }
            .addOnFailureListener { e -> ui { onDone(e.message ?: "gagal daftar") } }
    }

    fun pullAll() {
        if (!enabled) return
        val db = FirebaseFirestore.getInstance()
        db.collection("notas").get().addOnSuccessListener { qs ->
            if (qs.isEmpty) return@addOnSuccessListener
            CuciinStore.notas.clear()
            qs.documents.mapNotNull { it.toNota() }.forEach { CuciinStore.notas.add(it) }
            CuciinStore.bumpPublic()
        }
        db.collection("audit").orderBy("at").limitToLast(50).get().addOnSuccessListener { qs ->
            if (qs.isEmpty) return@addOnSuccessListener
            CuciinStore.audit.clear()
            qs.documents.reversed().forEach { d ->
                CuciinStore.audit.add(
                    AuditRow(
                        at = d.getString("at") ?: "",
                        user = d.getString("user") ?: "",
                        branchId = d.getString("branchId") ?: "",
                        action = d.getString("action") ?: "",
                        notaId = d.getString("notaId"),
                    ),
                )
            }
            CuciinStore.bumpPublic()
        }
    }

    fun pushNota(n: Nota) {
        if (!enabled) return
        FirebaseFirestore.getInstance().collection("notas").document(n.id).set(n.toMap(), SetOptions.merge())
    }

    fun pushAudit(row: AuditRow) {
        if (!enabled) return
        FirebaseFirestore.getInstance().collection("audit").add(
            hashMapOf(
                "at" to row.at,
                "user" to row.user,
                "branchId" to row.branchId,
                "action" to row.action,
                "notaId" to row.notaId,
            ),
        )
    }

    fun pushApprove(name: String, ok: Boolean) {
        if (!enabled) return
        FirebaseFirestore.getInstance().collection("users").whereEqualTo("name", name).get()
            .addOnSuccessListener { qs ->
                qs.documents.forEach { it.reference.update("approved", ok) }
            }
    }

    private fun Nota.toMap(): Map<String, Any?> = hashMapOf(
        "id" to id,
        "branchId" to branchId,
        "kasir" to kasir,
        "customer" to customer,
        "phone" to phone,
        "items" to items,
        "total" to total,
        "paid" to paid,
        "pay" to pay.name,
        "payMethod" to payMethod.name,
        "laundry" to laundry.name,
        "createdAt" to createdAt,
        "createdAtMs" to createdAtMs,
        "pickupAt" to pickupAt,
        "waSent" to waSent,
        "waAt" to waAt,
        "photos" to photos.toList(),
        "dropOut" to dropOut,
    )

    private fun com.google.firebase.firestore.DocumentSnapshot.toNota(): Nota? {
        val id = getString("id") ?: id
        return Nota(
            id = id,
            branchId = getString("branchId") ?: return null,
            kasir = getString("kasir") ?: "",
            customer = getString("customer") ?: "",
            phone = getString("phone") ?: "",
            items = getString("items") ?: "",
            total = (getLong("total") ?: 0L).toInt(),
            paid = (getLong("paid") ?: 0L).toInt(),
            pay = if (getString("pay") == "Lunas") PayStatus.Lunas else PayStatus.Belum,
            laundry = when (getString("laundry")) {
                "Progress" -> LaundryStatus.Progress
                "Selesai" -> LaundryStatus.Selesai
                else -> LaundryStatus.Masuk
            },
            createdAt = getString("createdAt") ?: "",
            createdAtMs = getLong("createdAtMs") ?: 0L,
            pickupAt = getString("pickupAt") ?: "",
            waSent = getBoolean("waSent") ?: false,
            waAt = getString("waAt"),
            photos = (get("photos") as? List<*>)?.mapNotNull { it as? String }?.toMutableList() ?: mutableListOf(),
            dropOut = getBoolean("dropOut") ?: false,
            payMethod = when (getString("payMethod")) {
                "Qris" -> PayMethod.Qris
                "Transfer" -> PayMethod.Transfer
                else -> PayMethod.Tunai
            },
        )
    }
}
