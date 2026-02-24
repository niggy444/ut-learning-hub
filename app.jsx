import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  BookOpen, 
  Search, 
  Plus, 
  FileText, 
  Filter,
  X,
  Trash2,
  Edit3,
  ShieldCheck,
  Download,
  ShieldAlert,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE (CORREGIDA) ---
// Usamos las variables globales proporcionadas por el entorno para evitar errores de API Key
const firebaseConfig = JSON.parse(__firebase_config); 
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ut-repo-react-node';

// --- CONFIGURACIÓN DE NEGOCIO ---
const CAREERS = [
  "Todas",
  "Ingeniería en Software",
  "Mantenimiento Industrial",
  "Desarrollo de Negocios",
  "Gastronomía",
  "Mecatrónica",
  "Energías Renovables"
];

const ROLES = {
  STUDENT: 'estudiante',
  VERIFIER: 'verificador',
  ADMIN: 'administrador'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [filter, setFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formState, setFormState] = useState({ title: '', career: '', url: '', author: '' });
  const [isSaving, setIsSaving] = useState(false);

  // 1. Inicialización de Autenticación (REGLA 3: Auth antes de consultas)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Error de Autenticación:", err); 
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // REGLA 1: Rutas estrictas para perfiles
        const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', currentUser.uid);
        try {
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data());
          } else {
            const newProfile = {
              uid: currentUser.uid,
              role: ROLES.STUDENT,
              name: `Estudiante_${currentUser.uid.substring(0, 4)}`,
              joinedAt: new Date().toISOString()
            };
            await setDoc(profileRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error("Error al obtener perfil:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Suscripción a Datos (REGLA 3: Guard con !user)
  useEffect(() => {
    if (!user) return;

    // REGLA 1: Ruta para materiales públicos
    const materialsRef = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
    const unsubMaterials = onSnapshot(materialsRef, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error en materiales:", error);
    });

    // REGLA 1: Ruta para lista de perfiles
    const profilesRef = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
    const unsubProfiles = onSnapshot(profilesRef, (snapshot) => {
      setUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error en perfiles:", error);
    });

    return () => { unsubMaterials(); unsubProfiles(); };
  }, [user]);

  const canModify = (item) => {
    if (!userProfile) return false;
    if ([ROLES.ADMIN, ROLES.VERIFIER].includes(userProfile.role)) return true;
    return item.uploaderId === user.uid;
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const matRef = collection(db, 'artifacts', appId, 'public', 'data', 'materials');
      if (editingMaterial) {
        await updateDoc(doc(matRef, editingMaterial.id), { ...formState });
      } else {
        await addDoc(matRef, {
          ...formState,
          uploaderId: user.uid,
          uploaderName: userProfile.name,
          createdAt: serverTimestamp(),
          verified: userProfile.role !== ROLES.STUDENT
        });
      }
      setIsModalOpen(false);
      setEditingMaterial(null);
      setFormState({ title: '', career: '', url: '', author: '' });
    } catch (err) { 
      console.error("Error al guardar:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    if (confirm("¿Estás seguro de eliminar este recurso educativo?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materials', id));
      } catch (err) { console.error("Error al borrar:", err); }
    }
  };

  // Filtrado en memoria (REGLA 2: No consultas complejas)
  const filteredMaterials = useMemo(() => {
    return materials
      .filter(m => filter === "Todas" || m.career === filter)
      .filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [materials, filter, searchTerm]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-20">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><BookOpen size={22} /></div>
          <span className="font-bold text-lg">UT Learning <span className="text-indigo-600">Hub</span></span>
        </div>
        <div className="flex items-center gap-4">
          {userProfile?.role === ROLES.ADMIN && (
            <button onClick={() => setIsAdminPanelOpen(true)} className="text-slate-500 hover:text-indigo-600 uppercase text-[10px] font-black tracking-widest flex items-center gap-1">
              <ShieldCheck size={16} /> Admin
            </button>
          )}
          <button onClick={() => { setEditingMaterial(null); setFormState({title:'', career:'', url:'', author:''}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-100"><Plus size={18} className="inline mr-1"/> Subir</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Buscar material didáctico..." className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className="bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-600 outline-none shadow-sm cursor-pointer" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 font-medium animate-pulse">Cargando repositorio de la UT...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map(mat => (
              <div key={mat.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 hover:shadow-xl transition-all group">
                <div className="flex justify-between mb-4">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded">{mat.career}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canModify(mat) && (
                      <>
                        <button onClick={() => { setEditingMaterial(mat); setFormState({...mat}); setIsModalOpen(true); }} className="text-slate-300 hover:text-amber-500"><Edit3 size={16}/></button>
                        <button onClick={() => handleDelete(mat.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-6 line-clamp-2 h-14 leading-tight">{mat.title}</h3>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                      {mat.uploaderName?.charAt(0) || 'U'}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{mat.uploaderName}</span>
                  </div>
                  <a href={mat.url} target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-200">
                    <Download size={18}/>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Selector de Simulación de Rol (Solo para Prototipado) */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-2 flex justify-center gap-2 text-[10px] z-[100] border-t border-slate-700 shadow-2xl">
        <span className="text-slate-500 uppercase font-black self-center mr-2 flex items-center gap-1"><ShieldAlert size={12}/> Cambiar Mi Rol:</span>
        {Object.values(ROLES).map(r => (
          <button 
            key={r} 
            onClick={async () => {
              if (!user) return;
              const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid);
              await updateDoc(pRef, { role: r });
              setUserProfile(prev => ({...prev, role: r}));
            }}
            className={`px-3 py-1 rounded font-bold uppercase tracking-tighter transition-all ${userProfile?.role === r ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Modal Subida */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">{editingMaterial ? 'Editar Recurso' : 'Subir Material'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Título</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Ej: Apuntes de Física III" value={formState.title} onChange={e => setFormState({...formState, title: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Carrera</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" value={formState.career} onChange={e => setFormState({...formState, career: e.target.value})}>
                  <option value="">Selecciona carrera...</option>
                  {CAREERS.filter(c => c !== "Todas").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Enlace de descarga (Drive/Cloud)</label>
                <input required type="url" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="https://..." value={formState.url} onChange={e => setFormState({...formState, url: e.target.value})} />
              </div>
              <button disabled={isSaving} className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-slate-300">
                {isSaving ? 'Guardando...' : 'Publicar Material'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin (Control de Roles) */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <ShieldCheck className="text-indigo-600" /> Moderación de Comunidad
                </h2>
                <p className="text-slate-500 text-sm">Gestiona quién puede verificar material.</p>
              </div>
              <button onClick={() => setIsAdminPanelOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {usersList.map(u => (
                <div key={u.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 uppercase">
                      {u.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{u.name} {u.uid === user.uid && "(Tú)"}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{u.uid}</p>
                    </div>
                  </div>
                  <select 
                    disabled={u.uid === user.uid}
                    value={u.role}
                    onChange={async (e) => {
                      const pRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', u.uid);
                      await updateDoc(pRef, { role: e.target.value });
                    }}
                    className="text-[10px] font-black p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 uppercase"
                  >
                    <option value={ROLES.STUDENT}>Estudiante</option>
                    <option value={ROLES.VERIFIER}>Verificador</option>
                    <option value={ROLES.ADMIN}>Administrador</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}