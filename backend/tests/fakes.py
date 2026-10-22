"""In-memory stand-ins for Firestore (with optimistic transactions) used by the offline test suite.

Nothing here talks to the network. The fake keeps documents in a flat ``{path: dict}`` store and
bumps a per-path version on every write, so a transaction can detect that a document it read was
changed by someone else before it committed (the real Firestore behaviour) and retry.
"""
import copy

STORE = {}          # "Users/personal/curricula/c1" -> {...}
VERS = {}           # path -> int, bumped on every write
CONFLICT = {"on": True}           # turn off to prove the harness would double-spend without transactions
HOOK = {"before_commit": None}    # a callable run once between a transaction's reads and its commit
STATS = {"attempts": 0}
_auto = [0]


class Inc:
    """Stand-in for firestore.Increment."""
    def __init__(self, v):
        self.value = v


def _copy(d):
    try:
        return copy.deepcopy(d)
    except Exception:  # sentinels etc.
        return dict(d)


def _deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v)
        else:
            dst[k] = _copy(v) if isinstance(v, (dict, list)) else v
    return dst


def _bump(path):
    VERS[path] = VERS.get(path, 0) + 1


class Snap:
    def __init__(self, id, d, ref=None):
        self.id, self._d, self.reference = id, d, ref
        self.exists = d is not None

    def to_dict(self):
        return None if self._d is None else _copy(self._d)

    def get(self, field):
        cur = self._d or {}
        for part in field.split("."):
            cur = cur.get(part) if isinstance(cur, dict) else None
        return cur


class Ref:
    def __init__(self, path):
        self.path = path
        self.id = path.split("/")[-1]

    @property
    def parent(self):
        return Col(self.path.rsplit("/", 1)[0])

    def collection(self, name):
        return Col(self.path + "/" + name)

    def collections(self):
        pre = self.path + "/"
        names = sorted({k[len(pre):].split("/")[0] for k in STORE if k.startswith(pre) and "/" in k[len(pre):]})
        return [Col(pre + n) for n in names]

    def get(self, transaction=None):
        if transaction is not None:
            transaction.reads[self.path] = VERS.get(self.path, 0)
        return Snap(self.id, STORE.get(self.path), self)

    def set(self, d, merge=False):
        if merge and self.path in STORE:
            _deep_merge(STORE[self.path], d)
        else:
            STORE[self.path] = _copy(d)
        _bump(self.path)

    def update(self, d):
        if self.path not in STORE:
            raise KeyError("404 No document to update: " + self.path)
        cur = STORE[self.path]
        for k, v in d.items():
            target, parts = cur, k.split(".")
            for p in parts[:-1]:
                target = target.setdefault(p, {})
            leaf = parts[-1]
            target[leaf] = (target.get(leaf) or 0) + v.value if isinstance(v, Inc) else v
        _bump(self.path)

    def delete(self):
        STORE.pop(self.path, None)
        _bump(self.path)

    def create(self, d):
        if self.path in STORE:
            raise RuntimeError("409 document already exists")
        self.set(d)


_OPS = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    "<": lambda a, b: a is not None and a < b,
    "<=": lambda a, b: a is not None and a <= b,
    ">": lambda a, b: a is not None and a > b,
    ">=": lambda a, b: a is not None and a >= b,
    "in": lambda a, b: a in b,
    "array_contains": lambda a, b: b in (a or []),
}


class Query:
    def __init__(self, col, filters=(), lim=None, order=None):
        self.col, self.f, self.lim, self.order = col, tuple(filters), lim, order

    def where(self, field, op, value):
        assert op in _OPS, "fake firestore: operator not supported: " + op
        return Query(self.col, self.f + ((field, op, value),), self.lim, self.order)

    def order_by(self, field, direction="ASCENDING"):
        return Query(self.col, self.f, self.lim, (field, direction))

    def limit(self, n):
        return Query(self.col, self.f, n, self.order)

    def stream(self):
        out = [d for d in self.col.stream()
               if all(_OPS[op]((d.to_dict() or {}).get(f), v) for f, op, v in self.f)]
        if self.order:
            out = [d for d in out if (d.to_dict() or {}).get(self.order[0]) is not None]
            out.sort(key=lambda d: d.to_dict()[self.order[0]], reverse=self.order[1] == "DESCENDING")
        return out[: self.lim] if self.lim else out

    def get(self):
        return self.stream()


class Col:
    def __init__(self, path):
        self.path = path

    def document(self, doc_id=None):
        if doc_id is None:
            _auto[0] += 1
            doc_id = "auto%d" % _auto[0]
        return Ref(self.path + "/" + doc_id)

    def add(self, d):
        ref = self.document()
        ref.set(d)
        return (None, ref)

    def where(self, field, op, value):
        return Query(self).where(field, op, value)

    def order_by(self, field, direction="ASCENDING"):
        return Query(self).order_by(field, direction)

    def limit(self, n):
        return Query(self).limit(n)

    def list_documents(self):
        pre = self.path + "/"
        ids = sorted({k[len(pre):].split("/")[0] for k in STORE if k.startswith(pre)})
        return [Ref(pre + i) for i in ids]

    def stream(self):
        pre = self.path + "/"
        return [Snap(k[len(pre):], v, Ref(k)) for k, v in sorted(STORE.items())
                if k.startswith(pre) and "/" not in k[len(pre):]]

    def get(self):
        return self.stream()


class Txn:
    def __init__(self):
        self.reads, self.writes = {}, []

    def reset(self):
        self.reads, self.writes = {}, []

    def set(self, ref, d, merge=False):
        self.writes.append(("set", ref, d, merge))

    def update(self, ref, d):
        self.writes.append(("update", ref, d, False))

    def delete(self, ref):
        self.writes.append(("delete", ref, None, False))

    def commit(self):
        if CONFLICT["on"] and any(VERS.get(p, 0) != v for p, v in self.reads.items()):
            return False
        for op, ref, d, merge in self.writes:
            if op == "set":
                ref.set(d, merge=merge)
            elif op == "update":
                ref.update(d)
            else:
                ref.delete()
        return True


def transactional(fn):
    """Replacement for firestore.transactional: run, commit if nothing we read changed, else retry."""
    def run(txn, *a, **k):
        for _ in range(5):
            txn.reset()
            STATS["attempts"] += 1
            res = fn(txn, *a, **k)
            hook = HOOK["before_commit"]
            if hook:
                HOOK["before_commit"] = None
                hook()   # another transaction commits between our reads and our commit
            if txn.commit():
                return res
        raise RuntimeError("transaction aborted after retries")
    return run


class FakeDB:
    def collection(self, name):
        return Col(name)

    def transaction(self):
        return Txn()


DB = FakeDB()


def reset_store():
    STORE.clear()
    VERS.clear()
    CONFLICT["on"] = True
    HOOK["before_commit"] = None
    STATS["attempts"] = 0
    _auto[0] = 0
