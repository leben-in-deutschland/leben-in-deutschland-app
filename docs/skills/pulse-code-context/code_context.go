package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"io/fs"
	"math"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	generatorName          = "pulse-code-context-go"
	schemaVersion          = 2
	backendName            = "lexical-bm25-json-gzip"
	manifestFileName       = "manifest.json"
	graphFileName          = "graph.json"
	indexFileName          = "index.json.gz"
	defaultMaxFileBytes    = 1_000_000
	defaultChunkLines      = 80
	defaultOverlapLines    = 4
	defaultSearchTopK      = 8
	defaultSearchNeighbors = 3
	defaultRelatedTopK     = 20
	snippetLimit           = 400
	bm25K1                 = 1.5
	bm25B                  = 0.75
	pathBoost              = 2.5
	symbolBoost            = 3.0
	exactPathBoost         = 3.5
	exactSymbolBoost       = 4.0
	gitTimeout             = 30 * time.Second
)

var (
	skippedDirectoryNames = map[string]struct{}{
		".cache":        {},
		".git":          {},
		".gradle":       {},
		".hg":           {},
		".mypy_cache":   {},
		".next":         {},
		".nuxt":         {},
		".parcel-cache": {},
		".pnpm-store":   {},
		".pytest_cache": {},
		".ruff_cache":   {},
		".serverless":   {},
		".svn":          {},
		".svelte-kit":   {},
		".terraform":    {},
		".tox":          {},
		".turbo":        {},
		".venv":         {},
		".yarn":         {},
		"__pycache__":   {},
		"bin":           {},
		"build":         {},
		"coverage":      {},
		"dist":          {},
		"htmlcov":       {},
		"node_modules":  {},
		"obj":           {},
		"out":           {},
		"target":        {},
		"temp":          {},
		"tmp":           {},
		"vendor":        {},
		"venv":          {},
	}
	skippedFileNames = map[string]struct{}{
		".env":              {},
		".netrc":            {},
		".npmrc":            {},
		".pypirc":           {},
		"cargo.lock":        {},
		"credentials":       {},
		"credentials.json":  {},
		"go.sum":            {},
		"id_dsa":            {},
		"id_ed25519":        {},
		"id_rsa":            {},
		"package-lock.json": {},
		"pnpm-lock.yaml":    {},
		"poetry.lock":       {},
		"uv.lock":           {},
		"yarn.lock":         {},
	}
	skippedSuffixes = map[string]struct{}{
		".7z":      {},
		".a":       {},
		".avi":     {},
		".bmp":     {},
		".cer":     {},
		".class":   {},
		".crt":     {},
		".db":      {},
		".dll":     {},
		".dylib":   {},
		".eot":     {},
		".exe":     {},
		".gif":     {},
		".gz":      {},
		".ico":     {},
		".jar":     {},
		".jpeg":    {},
		".jpg":     {},
		".key":     {},
		".lock":    {},
		".mov":     {},
		".mp3":     {},
		".mp4":     {},
		".o":       {},
		".otf":     {},
		".p12":     {},
		".pdf":     {},
		".pem":     {},
		".pfx":     {},
		".png":     {},
		".pyc":     {},
		".so":      {},
		".sqlite":  {},
		".sqlite3": {},
		".tar":     {},
		".tiff":    {},
		".ttf":     {},
		".wav":     {},
		".webm":    {},
		".webp":    {},
		".woff":    {},
		".woff2":   {},
		".xz":      {},
		".zip":     {},
	}
	languageBySuffix = map[string]string{
		".bash":  "shell",
		".c":     "c",
		".cc":    "cpp",
		".cfg":   "config",
		".clj":   "clojure",
		".cpp":   "cpp",
		".cs":    "csharp",
		".css":   "css",
		".go":    "go",
		".h":     "c",
		".hpp":   "cpp",
		".html":  "html",
		".java":  "java",
		".js":    "javascript",
		".json":  "json",
		".jsx":   "javascript",
		".kt":    "kotlin",
		".kts":   "kotlin",
		".md":    "markdown",
		".mdx":   "markdown",
		".mjs":   "javascript",
		".php":   "php",
		".ps1":   "powershell",
		".py":    "python",
		".rb":    "ruby",
		".rs":    "rust",
		".scss":  "scss",
		".sh":    "shell",
		".sql":   "sql",
		".swift": "swift",
		".toml":  "toml",
		".ts":    "typescript",
		".tsx":   "typescript",
		".txt":   "text",
		".vue":   "vue",
		".xml":   "xml",
		".yaml":  "yaml",
		".yml":   "yaml",
	}
	referenceExtensions = []string{"", ".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md", ".mdx", ".sh", ".go", ".rs", ".h", ".hpp", ".c", ".cc", ".cpp"}
	indexExtensions     = []string{".py", ".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".go", ".rs"}
	markdownHeadingRE   = regexp.MustCompile(`^(#{1,4})\s+(.+?)\s*#*\s*$`)
	pythonImportRE      = regexp.MustCompile(`^\s*import\s+(.+?)\s*$`)
	pythonFromImportRE  = regexp.MustCompile(`^\s*from\s+([.\w]+)\s+import\s+(.+?)\s*$`)
	markdownLinkRE      = regexp.MustCompile(`!?\[[^\]]*\]\(([^)]+)\)`)
	shellSourceRE       = regexp.MustCompile(`^\s*(?:source|\.)\s+["']?([^"'\s;]+)`)
	cIncludeRE          = regexp.MustCompile(`^\s*#\s*include\s+"([^"]+)"`)
	rustModRE           = regexp.MustCompile(`^\s*(?:pub\s+)?mod\s+([A-Za-z_]\w*)\s*;`)
	rustUseRE           = regexp.MustCompile(`^\s*(?:pub\s+)?use\s+crate::([A-Za-z0-9_:]+)`)
	jsImportPatterns    = []*regexp.Regexp{
		regexp.MustCompile(`\bfrom\s+["']([^"']+)["']`),
		regexp.MustCompile(`\brequire\(\s*["']([^"']+)["']\s*\)`),
		regexp.MustCompile(`\bimport\(\s*["']([^"']+)["']\s*\)`),
		regexp.MustCompile(`^\s*import\s+["']([^"']+)["']`),
	}
	symbolPatterns = map[string][]symbolPattern{
		"python": {
			{regexp.MustCompile(`^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)`), "function"},
			{regexp.MustCompile(`^\s*class\s+([A-Za-z_]\w*)`), "class"},
		},
		"javascript": {
			{regexp.MustCompile(`^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)`), "function"},
			{regexp.MustCompile(`^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)`), "class"},
		},
		"typescript": {
			{regexp.MustCompile(`^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)`), "function"},
			{regexp.MustCompile(`^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)`), "class"},
			{regexp.MustCompile(`^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)`), "interface"},
			{regexp.MustCompile(`^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)`), "type"},
		},
		"rust": {
			{regexp.MustCompile(`^\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)`), "function"},
			{regexp.MustCompile(`^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)`), "type"},
		},
		"java": {
			{regexp.MustCompile(`^\s*(?:public\s+)?(?:class|interface|enum|record)\s+([A-Za-z_]\w*)`), "type"},
		},
		"csharp": {
			{regexp.MustCompile(`^\s*(?:public\s+)?(?:class|interface|enum|record)\s+([A-Za-z_]\w*)`), "type"},
		},
		"ruby": {
			{regexp.MustCompile(`^\s*def\s+([A-Za-z_]\w*[!?=]?)`), "function"},
			{regexp.MustCompile(`^\s*class\s+([A-Za-z_:]\w*)`), "class"},
		},
		"php": {
			{regexp.MustCompile(`^\s*(?:public\s+|private\s+|protected\s+)?function\s+([A-Za-z_]\w*)`), "function"},
			{regexp.MustCompile(`^\s*class\s+([A-Za-z_]\w*)`), "class"},
		},
	}
)

type userError struct {
	message string
}

func (u userError) Error() string {
	return u.message
}

type helpRequest struct {
	command string
}

func (h helpRequest) Error() string {
	return h.command
}

type symbolPattern struct {
	re   *regexp.Regexp
	kind string
}

type Symbol struct {
	Name string `json:"name"`
	Line int    `json:"line"`
	Kind string `json:"kind"`
}

type SourceFile struct {
	Path     string
	Text     string
	Language string
	Kind     string
	Symbols  []Symbol
	Size     int64
	MTimeNS  int64
}

type Chunk struct {
	ID          string
	ChunkPath   string
	Path        string
	Language    string
	Kind        string
	Symbols     []string
	StartLine   int
	EndLine     int
	Content     string
	Snippet     string
	ContentHash string
}

type PathState struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	MTimeNS int64  `json:"mtime_ns"`
}

type GitState struct {
	Available bool   `json:"available"`
	Head      string `json:"head"`
	Status    string `json:"status"`
}

type IndexSettings struct {
	MaxFileBytes int64    `json:"max_file_bytes"`
	ChunkLines   int      `json:"chunk_lines"`
	OverlapLines int      `json:"overlap_lines"`
	Exclude      []string `json:"exclude"`
}

type Manifest struct {
	Generator      string        `json:"generator"`
	SchemaVersion  int           `json:"schema_version"`
	RepoRoot       string        `json:"repo_root"`
	RepoKey        string        `json:"repo_key"`
	Backend        string        `json:"backend"`
	IndexedAt      string        `json:"indexed_at"`
	Git            GitState      `json:"git"`
	CandidateState []PathState   `json:"candidate_state"`
	Files          int           `json:"files"`
	Chunks         int           `json:"chunks"`
	GraphEdges     int           `json:"graph_edges"`
	Settings       IndexSettings `json:"settings"`
}

type ChunkRecord struct {
	ID            string   `json:"id"`
	ChunkPath     string   `json:"chunk_path"`
	Path          string   `json:"path"`
	Language      string   `json:"language"`
	Kind          string   `json:"kind"`
	Symbols       []string `json:"symbols"`
	StartLine     int      `json:"start_line"`
	EndLine       int      `json:"end_line"`
	ContentHash   string   `json:"content_hash"`
	Content       string   `json:"content"`
	Snippet       string   `json:"snippet"`
	ContentLength int      `json:"content_length"`
	PathLength    int      `json:"path_length"`
	SymbolLength  int      `json:"symbol_length"`
}

type Posting struct {
	Chunk     int `json:"chunk"`
	ContentTF int `json:"content_tf,omitempty"`
	PathTF    int `json:"path_tf,omitempty"`
	SymbolTF  int `json:"symbol_tf,omitempty"`
}

type TermEntry struct {
	Term              string    `json:"term"`
	DocumentFrequency int       `json:"document_frequency"`
	Postings          []Posting `json:"postings"`
}

type IndexData struct {
	Generator        string        `json:"generator"`
	SchemaVersion    int           `json:"schema_version"`
	Backend          string        `json:"backend"`
	ChunkCount       int           `json:"chunk_count"`
	AvgContentLength float64       `json:"avg_content_length"`
	AvgPathLength    float64       `json:"avg_path_length"`
	AvgSymbolLength  float64       `json:"avg_symbol_length"`
	Chunks           []ChunkRecord `json:"chunks"`
	Terms            []TermEntry   `json:"terms"`
}

type GraphNode struct {
	Language string   `json:"language"`
	Kind     string   `json:"kind"`
	Symbols  []Symbol `json:"symbols"`
}

type GraphEdge struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
}

type GraphPayload struct {
	Nodes     map[string]GraphNode   `json:"nodes"`
	Outgoing  map[string][]GraphEdge `json:"outgoing"`
	Incoming  map[string][]GraphEdge `json:"incoming"`
	EdgeCount int                    `json:"edge_count"`
}

type IndexOptions struct {
	Repo         string
	CacheDir     string
	MaxFileBytes int64
	ChunkLines   int
	OverlapLines int
	Exclude      []string
}

type SearchOptions struct {
	Repo      string
	CacheDir  string
	Query     string
	TopK      int
	Neighbors int
}

type RelatedOptions struct {
	Repo     string
	CacheDir string
	Path     string
	TopK     int
}

type StatusOptions struct {
	Repo     string
	CacheDir string
}

type IndexPayload struct {
	Status        string `json:"status"`
	Repo          string `json:"repo"`
	Cache         string `json:"cache"`
	Generator     string `json:"generator"`
	SchemaVersion int    `json:"schema_version"`
	Backend       string `json:"backend"`
	Files         int    `json:"files"`
	Chunks        int    `json:"chunks"`
	GraphEdges    int    `json:"graph_edges"`
}

type RelatedItem struct {
	Path      string   `json:"path"`
	Weight    int      `json:"weight"`
	Relations []string `json:"relations"`
	Language  string   `json:"language,omitempty"`
	Kind      string   `json:"kind,omitempty"`
	Symbols   []string `json:"symbols,omitempty"`
}

type SearchHit struct {
	Rank         int           `json:"rank"`
	Score        float64       `json:"score"`
	Path         string        `json:"path"`
	ChunkPath    string        `json:"chunk_path"`
	StartLine    int           `json:"start_line"`
	EndLine      int           `json:"end_line"`
	Language     string        `json:"language"`
	Kind         string        `json:"kind"`
	Symbols      []string      `json:"symbols"`
	ContentHash  string        `json:"content_hash"`
	Snippet      string        `json:"snippet"`
	Content      string        `json:"content"`
	RelatedFiles []RelatedItem `json:"related_files"`
}

type SearchPayload struct {
	Query         string      `json:"query"`
	Repo          string      `json:"repo"`
	Cache         string      `json:"cache"`
	Generator     string      `json:"generator"`
	SchemaVersion int         `json:"schema_version"`
	Backend       string      `json:"backend"`
	Stale         bool        `json:"stale"`
	StaleReasons  []string    `json:"stale_reasons"`
	Results       []SearchHit `json:"results"`
}

type RelatedPayload struct {
	Repo          string        `json:"repo"`
	Cache         string        `json:"cache"`
	Path          string        `json:"path"`
	Generator     string        `json:"generator"`
	SchemaVersion int           `json:"schema_version"`
	Backend       string        `json:"backend"`
	Stale         bool          `json:"stale"`
	StaleReasons  []string      `json:"stale_reasons"`
	Node          GraphNode     `json:"node"`
	RelatedFiles  []RelatedItem `json:"related_files"`
}

type StatusPayload struct {
	Status        string   `json:"status"`
	Repo          string   `json:"repo"`
	Cache         string   `json:"cache"`
	Generator     string   `json:"generator,omitempty"`
	SchemaVersion int      `json:"schema_version,omitempty"`
	Backend       string   `json:"backend,omitempty"`
	IndexedAt     string   `json:"indexed_at,omitempty"`
	Fresh         bool     `json:"fresh"`
	StaleReasons  []string `json:"stale_reasons"`
	Files         int      `json:"files,omitempty"`
	Chunks        int      `json:"chunks,omitempty"`
	GraphEdges    int      `json:"graph_edges,omitempty"`
	Runtime       string   `json:"runtime"`
	RuntimeReady  bool     `json:"runtime_ready"`
}

type projectContext struct {
	knownPaths     map[string]struct{}
	goModulePath   string
	goPackageFiles map[string][]string
}

type relation struct {
	Source string
	Target string
	Kind   string
}

type targetRelation struct {
	Target string
	Kind   string
}

func expandUserPath(value string) string {
	if value == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
		return value
	}
	if strings.HasPrefix(value, "~/") || strings.HasPrefix(value, "~\\") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, value[2:])
		}
	}
	return value
}

func canonicalPath(value string) (string, error) {
	absolutePath, err := filepath.Abs(expandUserPath(value))
	if err != nil {
		return "", err
	}
	absolutePath = filepath.Clean(absolutePath)
	current := absolutePath
	var suffix []string
	for {
		_, err := os.Lstat(current)
		if err == nil {
			resolved, err := filepath.EvalSymlinks(current)
			if err != nil {
				return "", err
			}
			for index := len(suffix) - 1; index >= 0; index-- {
				resolved = filepath.Join(resolved, suffix[index])
			}
			return filepath.Clean(resolved), nil
		}
		if !os.IsNotExist(err) {
			return "", err
		}
		parent := filepath.Dir(current)
		if parent == current {
			resolved := current
			for index := len(suffix) - 1; index >= 0; index-- {
				resolved = filepath.Join(resolved, suffix[index])
			}
			return filepath.Clean(resolved), nil
		}
		suffix = append(suffix, filepath.Base(current))
		current = parent
	}
}

func resolveRepoRoot(value string) (string, error) {
	candidate, err := canonicalPath(value)
	if err != nil {
		return "", userError{message: fmt.Sprintf("Cannot resolve repository path: %v", err)}
	}
	info, err := os.Stat(candidate)
	if err != nil {
		return "", userError{message: fmt.Sprintf("Repository path does not exist: %s", candidate)}
	}
	probe := candidate
	if !info.IsDir() {
		probe = filepath.Dir(candidate)
	}
	if root, ok := gitRepoRoot(probe); ok {
		return canonicalPath(root)
	}
	return canonicalPath(probe)
}

func gitOutput(repo string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), gitTimeout)
	defer cancel()
	commandArgs := append([]string{"-C", repo}, args...)
	cmd := exec.CommandContext(ctx, "git", commandArgs...)
	output, err := cmd.Output()
	if ctx.Err() == context.DeadlineExceeded {
		return nil, userError{message: fmt.Sprintf("git command timed out: git %s", strings.Join(commandArgs, " "))}
	}
	if err != nil {
		return nil, err
	}
	return output, nil
}

func gitRepoRoot(probe string) (string, bool) {
	output, err := gitOutput(probe, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", false
	}
	root, err := filepath.Abs(strings.TrimSpace(string(output)))
	if err != nil {
		return "", false
	}
	return root, true
}

func defaultCacheRoot() (string, error) {
	explicit := os.Getenv("PULSE_CODE_CONTEXT_HOME")
	if explicit != "" {
		resolved, err := canonicalPath(explicit)
		if err != nil {
			return "", userError{message: fmt.Sprintf("Cannot resolve PULSE_CODE_CONTEXT_HOME: %v", err)}
		}
		return resolved, nil
	}
	userCache, err := os.UserCacheDir()
	if err != nil {
		return "", userError{message: fmt.Sprintf("Cannot determine the user cache directory: %v", err)}
	}
	resolved, err := canonicalPath(filepath.Join(userCache, "pulse", "code-context"))
	if err != nil {
		return "", userError{message: fmt.Sprintf("Cannot resolve the default cache directory: %v", err)}
	}
	return resolved, nil
}

func cacheRootFrom(value string) (string, error) {
	if value == "" {
		return defaultCacheRoot()
	}
	resolved, err := canonicalPath(value)
	if err != nil {
		return "", userError{message: fmt.Sprintf("Cannot resolve cache path: %v", err)}
	}
	return resolved, nil
}

func sanitizeSlug(name string) string {
	var builder strings.Builder
	for _, r := range name {
		switch {
		case unicode.IsLetter(r), unicode.IsDigit(r), r == '.', r == '_', r == '-':
			builder.WriteRune(r)
		default:
			builder.WriteRune('-')
		}
	}
	slug := strings.Trim(builder.String(), "-")
	if slug == "" {
		return "repository"
	}
	return slug
}

func repoCachePath(repo string, cacheRoot string) string {
	digest := sha256.Sum256([]byte(repo))
	slug := sanitizeSlug(filepath.Base(repo))
	return filepath.Join(cacheRoot, fmt.Sprintf("%s-%x", slug, digest[:8]))
}

func pathWithin(base string, target string) bool {
	rel, err := filepath.Rel(base, target)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)))
}

func ensureExternalCache(repo string, cacheRoot string) error {
	canonicalRepo, err := canonicalPath(repo)
	if err != nil {
		return userError{message: fmt.Sprintf("Cannot resolve repository path for cache safety: %v", err)}
	}
	canonicalCacheRoot, err := canonicalPath(cacheRoot)
	if err != nil {
		return userError{message: fmt.Sprintf("Cannot resolve cache path for cache safety: %v", err)}
	}
	if pathWithin(canonicalRepo, canonicalCacheRoot) {
		return userError{message: "The context cache must be outside the repository. Choose a user cache path instead."}
	}
	return nil
}

func ensureSafeCacheTarget(target string, cacheRoot string) error {
	canonicalTarget, err := canonicalPath(target)
	if err != nil {
		return userError{message: fmt.Sprintf("Cannot resolve cache target path: %v", err)}
	}
	canonicalCacheRoot, err := canonicalPath(cacheRoot)
	if err != nil {
		return userError{message: fmt.Sprintf("Cannot resolve cache root path: %v", err)}
	}
	if canonicalTarget == canonicalCacheRoot || !pathWithin(canonicalCacheRoot, canonicalTarget) {
		return userError{message: fmt.Sprintf("Refusing unsafe cache operation outside %s: %s", cacheRoot, target)}
	}
	return nil
}

func removeCachePath(target string, cacheRoot string) error {
	if err := ensureSafeCacheTarget(target, cacheRoot); err != nil {
		return err
	}
	if _, err := os.Stat(target); err == nil {
		return os.RemoveAll(target)
	}
	return nil
}

func newStagingDir(cacheRoot string, finalBase string) (string, error) {
	for attempt := 0; attempt < 20; attempt++ {
		candidate := filepath.Join(cacheRoot, fmt.Sprintf("%s.staging-%d-%d-%d", finalBase, os.Getpid(), time.Now().UnixNano(), attempt))
		if err := ensureSafeCacheTarget(candidate, cacheRoot); err != nil {
			return "", err
		}
		err := os.Mkdir(candidate, 0o755)
		if err == nil {
			return candidate, nil
		}
		if os.IsExist(err) {
			continue
		}
		return "", err
	}
	return "", userError{message: "Could not allocate a sibling staging directory in the cache root."}
}

func writeJSONFile(filePath string, payload any) error {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(filePath, data, 0o644)
}

func writeGzipJSONFile(filePath string, payload any) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()
	writer, err := gzip.NewWriterLevel(file, gzip.BestCompression)
	if err != nil {
		return err
	}
	writer.Name = ""
	writer.Comment = ""
	writer.ModTime = time.Unix(0, 0)
	encoder := json.NewEncoder(writer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(payload); err != nil {
		writer.Close()
		return err
	}
	return writer.Close()
}

func readGzipJSONFile(filePath string, payload any) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()
	reader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer reader.Close()
	return json.NewDecoder(reader).Decode(payload)
}

func fileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return err == nil
}

func normalizeRepoPath(value string) string {
	value = strings.ReplaceAll(strings.TrimSpace(value), "\\", "/")
	value = path.Clean(value)
	value = strings.TrimPrefix(value, "./")
	if value == "." || value == "" || strings.HasPrefix(value, "../") {
		return ""
	}
	return value
}

func normalizeExcludePatterns(patterns []string) []string {
	seen := map[string]struct{}{}
	var normalized []string
	for _, pattern := range patterns {
		trimmed := strings.TrimSpace(pattern)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	sort.Strings(normalized)
	return normalized
}

func globMatch(pattern string, name string) bool {
	if pattern == "" {
		return false
	}
	var builder strings.Builder
	builder.WriteString("^")
	for i := 0; i < len(pattern); i++ {
		switch pattern[i] {
		case '*':
			if i+1 < len(pattern) && pattern[i+1] == '*' {
				builder.WriteString(".*")
				i++
			} else {
				builder.WriteString("[^/]*")
			}
		case '?':
			builder.WriteString("[^/]")
		default:
			if strings.ContainsRune(`.+()|[]{}^$\\`, rune(pattern[i])) {
				builder.WriteByte('\\')
			}
			builder.WriteByte(pattern[i])
		}
	}
	builder.WriteString("$")
	matched, err := regexp.MatchString(builder.String(), name)
	return err == nil && matched
}

func pathIsSkipped(relativePath string, extraPatterns []string) bool {
	relativePath = normalizeRepoPath(relativePath)
	if relativePath == "" {
		return true
	}
	parts := strings.Split(relativePath, "/")
	for _, part := range parts[:len(parts)-1] {
		if _, ok := skippedDirectoryNames[strings.ToLower(part)]; ok {
			return true
		}
	}
	name := strings.ToLower(parts[len(parts)-1])
	if _, ok := skippedDirectoryNames[name]; ok {
		return true
	}
	if _, ok := skippedFileNames[name]; ok {
		return true
	}
	if strings.HasPrefix(name, ".env.") && !strings.HasSuffix(name, ".example") && !strings.HasSuffix(name, ".sample") && !strings.HasSuffix(name, ".template") {
		return true
	}
	if suffix := strings.ToLower(path.Ext(name)); suffix != "" {
		if _, ok := skippedSuffixes[suffix]; ok {
			return true
		}
	}
	for _, pattern := range extraPatterns {
		if globMatch(pattern, relativePath) {
			return true
		}
	}
	return false
}

func discoverPaths(repo string, extraPatterns []string) ([]string, error) {
	extraPatterns = normalizeExcludePatterns(extraPatterns)
	pathSet := map[string]struct{}{}
	if output, err := gitOutput(repo, "ls-files", "--cached", "--others", "--exclude-standard", "-z"); err == nil {
		for _, raw := range bytes.Split(output, []byte{0}) {
			relativePath := normalizeRepoPath(string(raw))
			if relativePath == "" || pathIsSkipped(relativePath, extraPatterns) {
				continue
			}
			absolutePath := filepath.Join(repo, filepath.FromSlash(relativePath))
			info, err := os.Lstat(absolutePath)
			if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
				continue
			}
			pathSet[relativePath] = struct{}{}
		}
	} else {
		walkErr := filepath.WalkDir(repo, func(current string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return nil
			}
			relativePath, err := filepath.Rel(repo, current)
			if err != nil {
				return nil
			}
			relativePath = normalizeRepoPath(filepath.ToSlash(relativePath))
			if relativePath == "" {
				return nil
			}
			if entry.Type()&os.ModeSymlink != 0 {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if entry.IsDir() {
				if pathIsSkipped(relativePath, extraPatterns) {
					return filepath.SkipDir
				}
				return nil
			}
			if !entry.Type().IsRegular() || pathIsSkipped(relativePath, extraPatterns) {
				return nil
			}
			pathSet[relativePath] = struct{}{}
			return nil
		})
		if walkErr != nil {
			return nil, walkErr
		}
	}
	paths := make([]string, 0, len(pathSet))
	for relativePath := range pathSet {
		paths = append(paths, relativePath)
	}
	sort.Strings(paths)
	return paths, nil
}

func candidateState(repo string, paths []string) []PathState {
	states := make([]PathState, 0, len(paths))
	for _, relativePath := range paths {
		absolutePath := filepath.Join(repo, filepath.FromSlash(relativePath))
		info, err := os.Lstat(absolutePath)
		if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
			continue
		}
		states = append(states, PathState{Path: relativePath, Size: info.Size(), MTimeNS: info.ModTime().UnixNano()})
	}
	sort.Slice(states, func(i, j int) bool {
		return states[i].Path < states[j].Path
	})
	return states
}

func gitState(repo string) GitState {
	statusOutput, err := gitOutput(repo, "status", "--short", "--untracked-files=all")
	if err != nil {
		return GitState{Available: false}
	}
	headOutput, err := gitOutput(repo, "rev-parse", "--verify", "HEAD")
	head := ""
	if err == nil {
		head = strings.TrimSpace(string(headOutput))
	}
	return GitState{
		Available: true,
		Head:      head,
		Status:    string(statusOutput),
	}
}

func languageFor(relativePath string) string {
	name := strings.ToLower(path.Base(relativePath))
	if name == "dockerfile" || name == "makefile" {
		return name
	}
	if language, ok := languageBySuffix[strings.ToLower(path.Ext(relativePath))]; ok {
		return language
	}
	return "text"
}

func kindFor(relativePath string, language string) string {
	lowered := strings.ToLower(relativePath)
	name := path.Base(lowered)
	if language == "markdown" {
		return "docs"
	}
	if strings.Contains("/"+lowered+"/", "/test/") || strings.Contains("/"+lowered+"/", "/tests/") || strings.HasPrefix(name, "test_") || strings.Contains(name, ".test.") || strings.Contains(name, ".spec.") || strings.HasSuffix(name, "_test.go") {
		return "test"
	}
	switch language {
	case "config", "json", "toml", "yaml", "xml", "dockerfile", "makefile":
		return "config"
	default:
		return "code"
	}
}

func extractGoSymbols(text string) []Symbol {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "", text, parser.SkipObjectResolution)
	if err != nil {
		return nil
	}
	var symbols []Symbol
	for _, declaration := range file.Decls {
		switch node := declaration.(type) {
		case *ast.FuncDecl:
			kind := "function"
			if node.Recv != nil {
				kind = "method"
			}
			symbols = append(symbols, Symbol{Name: node.Name.Name, Line: fset.Position(node.Pos()).Line, Kind: kind})
		case *ast.GenDecl:
			for _, spec := range node.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}
				kind := "type"
				switch typeSpec.Type.(type) {
				case *ast.StructType:
					kind = "struct"
				case *ast.InterfaceType:
					kind = "interface"
				}
				symbols = append(symbols, Symbol{Name: typeSpec.Name.Name, Line: fset.Position(typeSpec.Pos()).Line, Kind: kind})
			}
		}
	}
	sort.Slice(symbols, func(i, j int) bool {
		if symbols[i].Line == symbols[j].Line {
			return symbols[i].Name < symbols[j].Name
		}
		return symbols[i].Line < symbols[j].Line
	})
	return symbols
}

func extractSymbols(text string, language string) []Symbol {
	if language == "go" {
		return extractGoSymbols(text)
	}
	if language == "markdown" {
		lines := strings.Split(text, "\n")
		symbols := make([]Symbol, 0)
		for index, line := range lines {
			match := markdownHeadingRE.FindStringSubmatch(line)
			if match == nil {
				continue
			}
			symbols = append(symbols, Symbol{Name: strings.TrimSpace(match[2]), Line: index + 1, Kind: fmt.Sprintf("heading-%d", len(match[1]))})
		}
		return symbols
	}
	patterns := symbolPatterns[language]
	if len(patterns) == 0 {
		return nil
	}
	lines := strings.Split(text, "\n")
	symbols := make([]Symbol, 0)
	for index, line := range lines {
		for _, pattern := range patterns {
			match := pattern.re.FindStringSubmatch(line)
			if match == nil {
				continue
			}
			symbols = append(symbols, Symbol{Name: match[1], Line: index + 1, Kind: pattern.kind})
			break
		}
	}
	return symbols
}

func readSourceFile(repo string, relativePath string, maxFileBytes int64) (SourceFile, bool) {
	absolutePath := filepath.Join(repo, filepath.FromSlash(relativePath))
	info, err := os.Lstat(absolutePath)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return SourceFile{}, false
	}
	if info.Size() == 0 || info.Size() > maxFileBytes {
		return SourceFile{}, false
	}
	data, err := os.ReadFile(absolutePath)
	if err != nil {
		return SourceFile{}, false
	}
	probe := data
	if len(probe) > 8192 {
		probe = probe[:8192]
	}
	if bytes.IndexByte(probe, 0) >= 0 {
		return SourceFile{}, false
	}
	if bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}) {
		data = data[3:]
	}
	if !utf8.Valid(data) {
		return SourceFile{}, false
	}
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	if strings.TrimSpace(text) == "" {
		return SourceFile{}, false
	}
	language := languageFor(relativePath)
	return SourceFile{
		Path:     relativePath,
		Text:     text,
		Language: language,
		Kind:     kindFor(relativePath, language),
		Symbols:  extractSymbols(text, language),
		Size:     info.Size(),
		MTimeNS:  info.ModTime().UnixNano(),
	}, true
}

func splitLines(text string) []string {
	lines := strings.Split(text, "\n")
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

func chooseChunkEnd(lines []string, start int, chunkLines int) int {
	end := start + chunkLines
	if end >= len(lines) {
		return len(lines)
	}
	lowerBound := end - 12
	if lowerBound < start+1 {
		lowerBound = start + 1
	}
	for candidate := end - 1; candidate >= lowerBound; candidate-- {
		if strings.TrimSpace(lines[candidate]) == "" {
			return candidate + 1
		}
	}
	return end
}

func hashHex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return fmt.Sprintf("%x", sum[:])
}

func snippetFor(content string) string {
	runes := []rune(content)
	if len(runes) <= snippetLimit {
		return content
	}
	return string(runes[:snippetLimit]) + "…"
}

func chunksFor(source SourceFile, chunkLines int, overlapLines int) []Chunk {
	lines := splitLines(source.Text)
	if len(lines) == 0 {
		return nil
	}
	chunks := make([]Chunk, 0)
	for start := 0; start < len(lines); {
		end := chooseChunkEnd(lines, start, chunkLines)
		content := strings.TrimSpace(strings.Join(lines[start:end], "\n"))
		if content != "" {
			startLine := start + 1
			endLine := end
			chunkSymbols := make([]string, 0)
			for _, symbol := range source.Symbols {
				if symbol.Line >= startLine && symbol.Line <= endLine {
					chunkSymbols = append(chunkSymbols, symbol.Name)
				}
			}
			contentHash := hashHex(content)
			chunkID := hashHex(fmt.Sprintf("%s:%d:%d:%s", source.Path, startLine, endLine, contentHash))[:40]
			chunks = append(chunks, Chunk{
				ID:          chunkID,
				ChunkPath:   fmt.Sprintf("%s#L%d-L%d", source.Path, startLine, endLine),
				Path:        source.Path,
				Language:    source.Language,
				Kind:        source.Kind,
				Symbols:     append([]string(nil), chunkSymbols...),
				StartLine:   startLine,
				EndLine:     endLine,
				Content:     content,
				Snippet:     snippetFor(content),
				ContentHash: contentHash,
			})
		}
		if end >= len(lines) {
			break
		}
		nextStart := end - overlapLines
		if nextStart <= start {
			nextStart = start + 1
		}
		start = nextStart
	}
	return chunks
}

func collectRawTokens(text string) []string {
	var tokens []string
	var builder strings.Builder
	flush := func() {
		if builder.Len() == 0 {
			return
		}
		tokens = append(tokens, builder.String())
		builder.Reset()
	}
	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			builder.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return tokens
}

func identifierParts(token string) []string {
	segments := strings.FieldsFunc(token, func(r rune) bool {
		return r == '_'
	})
	parts := make([]string, 0)
	for _, segment := range segments {
		if segment == "" {
			continue
		}
		runes := []rune(segment)
		start := 0
		for i := 1; i < len(runes); i++ {
			prev := runes[i-1]
			curr := runes[i]
			nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])
			boundary := false
			switch {
			case unicode.IsDigit(prev) != unicode.IsDigit(curr):
				boundary = true
			case unicode.IsLower(prev) && unicode.IsUpper(curr):
				boundary = true
			case unicode.IsUpper(prev) && unicode.IsUpper(curr) && nextLower:
				boundary = true
			}
			if boundary {
				parts = append(parts, string(runes[start:i]))
				start = i
			}
		}
		parts = append(parts, string(runes[start:]))
	}
	return parts
}

func tokenizeText(text string) []string {
	rawTokens := collectRawTokens(text)
	tokens := make([]string, 0, len(rawTokens)*3)
	for _, rawToken := range rawTokens {
		seen := map[string]struct{}{}
		add := func(value string) {
			value = strings.ToLower(strings.TrimSpace(value))
			if value == "" {
				return
			}
			if _, ok := seen[value]; ok {
				return
			}
			seen[value] = struct{}{}
			tokens = append(tokens, value)
		}
		parts := identifierParts(rawToken)
		add(rawToken)
		if len(parts) > 1 {
			add(strings.Join(parts, ""))
		}
		for _, part := range parts {
			add(part)
		}
	}
	return tokens
}

func countTokens(tokens []string) map[string]int {
	counts := make(map[string]int, len(tokens))
	for _, token := range tokens {
		counts[token]++
	}
	return counts
}

func canonicalIdentifier(value string) string {
	var builder strings.Builder
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(unicode.ToLower(r))
		}
	}
	return builder.String()
}

func buildProjectContext(repo string, sources []SourceFile) projectContext {
	knownPaths := make(map[string]struct{}, len(sources))
	goPackageFiles := map[string][]string{}
	for _, source := range sources {
		knownPaths[source.Path] = struct{}{}
		if source.Language == "go" {
			directory := path.Dir(source.Path)
			if directory == "." {
				directory = ""
			}
			goPackageFiles[directory] = append(goPackageFiles[directory], source.Path)
		}
	}
	for directory := range goPackageFiles {
		sort.Strings(goPackageFiles[directory])
	}
	return projectContext{
		knownPaths:     knownPaths,
		goModulePath:   readGoModulePath(repo),
		goPackageFiles: goPackageFiles,
	}
}

func readGoModulePath(repo string) string {
	goModPath := filepath.Join(repo, "go.mod")
	data, err := os.ReadFile(goModPath)
	if err != nil {
		return ""
	}
	match := regexp.MustCompile(`(?m)^\s*module\s+(\S+)`).FindStringSubmatch(string(data))
	if match == nil {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func normalizeReference(reference string) string {
	reference = strings.TrimSpace(reference)
	if reference == "" || strings.HasPrefix(reference, "#") {
		return ""
	}
	parsed, err := url.Parse(reference)
	if err == nil {
		if parsed.Scheme != "" || parsed.Host != "" {
			return ""
		}
		reference = parsed.Path
	}
	reference = strings.ReplaceAll(reference, "\\", "/")
	reference = path.Clean(reference)
	if reference == "." || reference == "" {
		return ""
	}
	return reference
}

func referenceCandidates(sourcePath string, reference string) []string {
	normalized := normalizeReference(reference)
	if normalized == "" {
		return nil
	}
	sourceParent := path.Dir(sourcePath)
	if sourceParent == "." {
		sourceParent = ""
	}
	base := normalized
	if strings.HasPrefix(normalized, "/") {
		base = strings.TrimPrefix(normalized, "/")
	} else {
		base = path.Clean(path.Join(sourceParent, normalized))
	}
	if base == "." || base == "" || strings.HasPrefix(base, "../") {
		return nil
	}
	seen := map[string]struct{}{}
	candidates := make([]string, 0, 1+len(referenceExtensions)+len(indexExtensions)+1)
	appendCandidate := func(candidate string) {
		candidate = normalizeRepoPath(candidate)
		if candidate == "" {
			return
		}
		if _, ok := seen[candidate]; ok {
			return
		}
		seen[candidate] = struct{}{}
		candidates = append(candidates, candidate)
	}
	appendCandidate(base)
	if path.Ext(base) == "" {
		for _, extension := range referenceExtensions[1:] {
			appendCandidate(base + extension)
		}
		for _, extension := range indexExtensions {
			appendCandidate(path.Join(base, "index"+extension))
		}
		appendCandidate(path.Join(base, "__init__.py"))
	}
	return candidates
}

func resolveReference(sourcePath string, reference string, knownPaths map[string]struct{}) string {
	for _, candidate := range referenceCandidates(sourcePath, reference) {
		if candidate == sourcePath {
			continue
		}
		if _, ok := knownPaths[candidate]; ok {
			return candidate
		}
	}
	return ""
}

func splitPythonImportItems(value string) []string {
	value = strings.ReplaceAll(value, "(", "")
	value = strings.ReplaceAll(value, ")", "")
	value = strings.ReplaceAll(value, "\\", "")
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		items = append(items, item)
	}
	return items
}

func pythonImportReferences(source SourceFile) []string {
	lines := strings.Split(source.Text, "\n")
	references := make([]string, 0)
	sourceParent := path.Dir(source.Path)
	if sourceParent == "." {
		sourceParent = ""
	}
	for _, line := range lines {
		if match := pythonImportRE.FindStringSubmatch(line); match != nil {
			for _, item := range splitPythonImportItems(match[1]) {
				name := strings.TrimSpace(strings.Split(item, " as ")[0])
				if name == "" {
					continue
				}
				references = append(references, "/"+strings.ReplaceAll(name, ".", "/"))
			}
			continue
		}
		match := pythonFromImportRE.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		moduleSpec := strings.TrimSpace(match[1])
		leadingDots := 0
		for leadingDots < len(moduleSpec) && moduleSpec[leadingDots] == '.' {
			leadingDots++
		}
		module := strings.ReplaceAll(strings.TrimLeft(moduleSpec, "."), ".", "/")
		prefix := module
		if leadingDots > 0 {
			base := sourceParent
			for step := 0; step < leadingDots-1; step++ {
				base = path.Dir(base)
				if base == "." {
					base = ""
				}
			}
			prefix = normalizeRepoPath(path.Join(base, module))
		}
		if prefix != "" {
			references = append(references, "/"+prefix)
		}
		for _, item := range splitPythonImportItems(match[2]) {
			name := strings.TrimSpace(strings.Split(item, " as ")[0])
			if name == "" || name == "*" {
				continue
			}
			reference := strings.ReplaceAll(name, ".", "/")
			if prefix != "" {
				reference = path.Join(prefix, reference)
			}
			references = append(references, "/"+reference)
		}
	}
	return references
}

func javascriptReferences(text string) []string {
	references := make([]string, 0)
	for _, pattern := range jsImportPatterns {
		matches := pattern.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			references = append(references, match[1])
		}
	}
	return references
}

func parseGoImportPaths(text string) []string {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "", text, parser.ImportsOnly)
	if err != nil {
		return nil
	}
	imports := make([]string, 0, len(file.Imports))
	for _, entry := range file.Imports {
		value, err := strconv.Unquote(entry.Path.Value)
		if err != nil {
			continue
		}
		imports = append(imports, value)
	}
	return imports
}

func goImportTargets(source SourceFile, ctx projectContext) []string {
	if ctx.goModulePath == "" {
		return nil
	}
	targets := map[string]struct{}{}
	for _, importPath := range parseGoImportPaths(source.Text) {
		switch {
		case importPath == ctx.goModulePath || strings.HasPrefix(importPath, ctx.goModulePath+"/"):
			relativeDir := strings.TrimPrefix(importPath, ctx.goModulePath)
			relativeDir = strings.TrimPrefix(relativeDir, "/")
			relativeDir = normalizeRepoPath(relativeDir)
			if relativeDir == "." {
				relativeDir = ""
			}
			for _, target := range ctx.goPackageFiles[relativeDir] {
				if target != source.Path {
					targets[target] = struct{}{}
				}
			}
		case strings.HasPrefix(importPath, "./") || strings.HasPrefix(importPath, "../") || strings.HasPrefix(importPath, "/"):
			if target := resolveReference(source.Path, importPath, ctx.knownPaths); target != "" {
				targets[target] = struct{}{}
			}
		}
	}
	result := make([]string, 0, len(targets))
	for target := range targets {
		result = append(result, target)
	}
	sort.Strings(result)
	return result
}

func rustChildModuleDir(sourcePath string) string {
	directory := path.Dir(sourcePath)
	if directory == "." {
		directory = ""
	}
	base := path.Base(sourcePath)
	switch base {
	case "lib.rs", "main.rs", "mod.rs":
		return directory
	default:
		return path.Join(directory, strings.TrimSuffix(base, path.Ext(base)))
	}
}

func resolveRustUsePath(reference string, knownPaths map[string]struct{}) string {
	segments := strings.Split(reference, "::")
	roots := []string{"src", ""}
	for _, root := range roots {
		for end := len(segments); end >= 1; end-- {
			parts := append([]string{}, segments[:end]...)
			joined := path.Join(parts...)
			if root != "" {
				joined = path.Join(root, joined)
			}
			candidates := []string{joined + ".rs", path.Join(joined, "mod.rs")}
			for _, candidate := range candidates {
				candidate = normalizeRepoPath(candidate)
				if _, ok := knownPaths[candidate]; ok {
					return candidate
				}
			}
		}
	}
	return ""
}

func rustTargets(source SourceFile, ctx projectContext) []targetRelation {
	results := make([]targetRelation, 0)
	seen := map[string]struct{}{}
	childDir := rustChildModuleDir(source.Path)
	for _, line := range strings.Split(source.Text, "\n") {
		if match := rustModRE.FindStringSubmatch(line); match != nil {
			moduleName := match[1]
			candidates := []string{
				normalizeRepoPath(path.Join(childDir, moduleName+".rs")),
				normalizeRepoPath(path.Join(childDir, moduleName, "mod.rs")),
			}
			for _, candidate := range candidates {
				if candidate == "" || candidate == source.Path {
					continue
				}
				if _, ok := ctx.knownPaths[candidate]; ok {
					key := candidate + "\x00modules"
					if _, exists := seen[key]; !exists {
						seen[key] = struct{}{}
						results = append(results, targetRelation{Target: candidate, Kind: "modules"})
					}
				}
			}
		}
		if match := rustUseRE.FindStringSubmatch(line); match != nil {
			if target := resolveRustUsePath(match[1], ctx.knownPaths); target != "" && target != source.Path {
				key := target + "\x00uses"
				if _, exists := seen[key]; !exists {
					seen[key] = struct{}{}
					results = append(results, targetRelation{Target: target, Kind: "uses"})
				}
			}
		}
	}
	sort.Slice(results, func(i, j int) bool {
		if results[i].Target == results[j].Target {
			return results[i].Kind < results[j].Kind
		}
		return results[i].Target < results[j].Target
	})
	return results
}

func extractReferenceEdges(source SourceFile, ctx projectContext) []relation {
	edges := make([]relation, 0)
	seen := map[string]struct{}{}
	add := func(target string, kind string) {
		if target == "" || target == source.Path {
			return
		}
		key := source.Path + "\x00" + target + "\x00" + kind
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		edges = append(edges, relation{Source: source.Path, Target: target, Kind: kind})
	}
	switch source.Language {
	case "python":
		for _, reference := range pythonImportReferences(source) {
			add(resolveReference(source.Path, reference, ctx.knownPaths), "imports")
		}
	case "javascript", "typescript", "vue":
		for _, reference := range javascriptReferences(source.Text) {
			add(resolveReference(source.Path, reference, ctx.knownPaths), "imports")
		}
	case "markdown":
		matches := markdownLinkRE.FindAllStringSubmatch(source.Text, -1)
		for _, match := range matches {
			add(resolveReference(source.Path, match[1], ctx.knownPaths), "links")
		}
	case "shell":
		for _, line := range strings.Split(source.Text, "\n") {
			match := shellSourceRE.FindStringSubmatch(line)
			if match != nil {
				add(resolveReference(source.Path, match[1], ctx.knownPaths), "sources")
			}
		}
	case "c", "cpp":
		for _, line := range strings.Split(source.Text, "\n") {
			match := cIncludeRE.FindStringSubmatch(line)
			if match != nil {
				add(resolveReference(source.Path, match[1], ctx.knownPaths), "includes")
			}
		}
	case "go":
		for _, target := range goImportTargets(source, ctx) {
			add(target, "imports")
		}
	case "rust":
		for _, target := range rustTargets(source, ctx) {
			add(target.Target, target.Kind)
		}
	}
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].Target == edges[j].Target {
			return edges[i].Kind < edges[j].Kind
		}
		return edges[i].Target < edges[j].Target
	})
	return edges
}

func graphPayloadFor(sources []SourceFile, edges []relation) GraphPayload {
	nodes := make(map[string]GraphNode, len(sources))
	for _, source := range sources {
		symbols := append([]Symbol(nil), source.Symbols...)
		nodes[source.Path] = GraphNode{Language: source.Language, Kind: source.Kind, Symbols: symbols}
	}
	outgoing := map[string][]GraphEdge{}
	incoming := map[string][]GraphEdge{}
	seen := map[string]struct{}{}
	edgeCount := 0
	for _, edge := range edges {
		key := edge.Source + "\x00" + edge.Target + "\x00" + edge.Kind
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		outgoing[edge.Source] = append(outgoing[edge.Source], GraphEdge{Path: edge.Target, Kind: edge.Kind})
		incoming[edge.Target] = append(incoming[edge.Target], GraphEdge{Path: edge.Source, Kind: edge.Kind})
		edgeCount++
	}
	for _, adjacency := range []map[string][]GraphEdge{outgoing, incoming} {
		for nodePath := range adjacency {
			sort.Slice(adjacency[nodePath], func(i, j int) bool {
				if adjacency[nodePath][i].Path == adjacency[nodePath][j].Path {
					return adjacency[nodePath][i].Kind < adjacency[nodePath][j].Kind
				}
				return adjacency[nodePath][i].Path < adjacency[nodePath][j].Path
			})
		}
	}
	return GraphPayload{Nodes: nodes, Outgoing: outgoing, Incoming: incoming, EdgeCount: edgeCount}
}

func relatedPaths(graph GraphPayload, sourcePath string, limit int) []RelatedItem {
	relationships := map[string]*RelatedItem{}
	appendEdge := func(direction string, edge GraphEdge) {
		item, ok := relationships[edge.Path]
		if !ok {
			item = &RelatedItem{Path: edge.Path}
			if node, exists := graph.Nodes[edge.Path]; exists {
				item.Language = node.Language
				item.Kind = node.Kind
				item.Symbols = make([]string, 0, len(node.Symbols))
				for _, symbol := range node.Symbols {
					item.Symbols = append(item.Symbols, symbol.Name)
				}
			}
			relationships[edge.Path] = item
		}
		item.Weight++
		item.Relations = append(item.Relations, direction+":"+edge.Kind)
	}
	for _, edge := range graph.Outgoing[sourcePath] {
		appendEdge("outgoing", edge)
	}
	for _, edge := range graph.Incoming[sourcePath] {
		appendEdge("incoming", edge)
	}
	items := make([]RelatedItem, 0, len(relationships))
	for _, item := range relationships {
		sort.Strings(item.Relations)
		items = append(items, *item)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Weight == items[j].Weight {
			return items[i].Path < items[j].Path
		}
		return items[i].Weight > items[j].Weight
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}

func replaceGeneratedCache(staging string, final string, cacheRoot string) error {
	if err := ensureSafeCacheTarget(staging, cacheRoot); err != nil {
		return err
	}
	if err := ensureSafeCacheTarget(final, cacheRoot); err != nil {
		return err
	}
	backup := filepath.Join(cacheRoot, fmt.Sprintf("%s.backup-%d", filepath.Base(final), os.Getpid()))
	if err := removeCachePath(backup, cacheRoot); err != nil {
		return err
	}
	if fileExists(final) {
		if err := os.Rename(final, backup); err != nil {
			return err
		}
	}
	if err := os.Rename(staging, final); err != nil {
		if fileExists(backup) && !fileExists(final) {
			_ = os.Rename(backup, final)
		}
		return err
	}
	if fileExists(backup) {
		if err := removeCachePath(backup, cacheRoot); err != nil {
			fmt.Fprintf(os.Stderr, "warning: old generated cache remains at %s: %v\n", backup, err)
		}
	}
	return nil
}

func buildIndex(options IndexOptions) (IndexPayload, error) {
	repo, err := resolveRepoRoot(options.Repo)
	if err != nil {
		return IndexPayload{}, err
	}
	cacheRoot, err := cacheRootFrom(options.CacheDir)
	if err != nil {
		return IndexPayload{}, err
	}
	if err := ensureExternalCache(repo, cacheRoot); err != nil {
		return IndexPayload{}, err
	}
	if options.MaxFileBytes <= 0 {
		return IndexPayload{}, userError{message: "--max-file-bytes must be greater than zero."}
	}
	if options.ChunkLines <= 0 {
		return IndexPayload{}, userError{message: "--chunk-lines must be greater than zero."}
	}
	if options.OverlapLines < 0 {
		return IndexPayload{}, userError{message: "--overlap-lines must be zero or greater."}
	}
	options.Exclude = normalizeExcludePatterns(options.Exclude)
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return IndexPayload{}, err
	}
	final := repoCachePath(repo, cacheRoot)
	staging, err := newStagingDir(cacheRoot, filepath.Base(final))
	if err != nil {
		return IndexPayload{}, err
	}
	completed := false
	defer func() {
		if !completed && fileExists(staging) {
			_ = removeCachePath(staging, cacheRoot)
		}
	}()

	paths, err := discoverPaths(repo, options.Exclude)
	if err != nil {
		return IndexPayload{}, err
	}
	beforeState := candidateState(repo, paths)
	sources := make([]SourceFile, 0)
	chunks := make([]ChunkRecord, 0)
	postingsMap := map[string]map[int]*Posting{}
	totalContentLength := 0
	totalPathLength := 0
	totalSymbolLength := 0

	getPosting := func(term string, chunkIndex int) *Posting {
		termPostings := postingsMap[term]
		if termPostings == nil {
			termPostings = map[int]*Posting{}
			postingsMap[term] = termPostings
		}
		posting := termPostings[chunkIndex]
		if posting == nil {
			posting = &Posting{Chunk: chunkIndex}
			termPostings[chunkIndex] = posting
		}
		return posting
	}

	for _, relativePath := range paths {
		source, ok := readSourceFile(repo, relativePath, options.MaxFileBytes)
		if !ok {
			continue
		}
		sources = append(sources, source)
		for _, chunk := range chunksFor(source, options.ChunkLines, options.OverlapLines) {
			contentTF := countTokens(tokenizeText(chunk.Content))
			pathTF := countTokens(tokenizeText(chunk.Path))
			symbolTF := countTokens(tokenizeText(strings.Join(chunk.Symbols, " ")))
			chunkIndex := len(chunks)
			chunkRecord := ChunkRecord{
				ID:            chunk.ID,
				ChunkPath:     chunk.ChunkPath,
				Path:          chunk.Path,
				Language:      chunk.Language,
				Kind:          chunk.Kind,
				Symbols:       append([]string(nil), chunk.Symbols...),
				StartLine:     chunk.StartLine,
				EndLine:       chunk.EndLine,
				ContentHash:   chunk.ContentHash,
				Content:       chunk.Content,
				Snippet:       chunk.Snippet,
				ContentLength: sumFrequencies(contentTF),
				PathLength:    sumFrequencies(pathTF),
				SymbolLength:  sumFrequencies(symbolTF),
			}
			chunks = append(chunks, chunkRecord)
			totalContentLength += chunkRecord.ContentLength
			totalPathLength += chunkRecord.PathLength
			totalSymbolLength += chunkRecord.SymbolLength
			for term, frequency := range contentTF {
				getPosting(term, chunkIndex).ContentTF = frequency
			}
			for term, frequency := range pathTF {
				getPosting(term, chunkIndex).PathTF = frequency
			}
			for term, frequency := range symbolTF {
				getPosting(term, chunkIndex).SymbolTF = frequency
			}
		}
	}
	if len(chunks) == 0 {
		return IndexPayload{}, userError{message: "No safe text files were available to index."}
	}
	afterPaths, err := discoverPaths(repo, options.Exclude)
	if err != nil {
		return IndexPayload{}, err
	}
	afterState := candidateState(repo, afterPaths)
	if !reflect.DeepEqual(paths, afterPaths) || !reflect.DeepEqual(beforeState, afterState) {
		return IndexPayload{}, userError{message: "Repository files changed during indexing; run the command again."}
	}
	project := buildProjectContext(repo, sources)
	edges := make([]relation, 0)
	for _, source := range sources {
		edges = append(edges, extractReferenceEdges(source, project)...)
	}
	graph := graphPayloadFor(sources, edges)
	terms := make([]TermEntry, 0, len(postingsMap))
	for term, postingMap := range postingsMap {
		postings := make([]Posting, 0, len(postingMap))
		for _, posting := range postingMap {
			postings = append(postings, *posting)
		}
		sort.Slice(postings, func(i, j int) bool {
			return postings[i].Chunk < postings[j].Chunk
		})
		terms = append(terms, TermEntry{Term: term, DocumentFrequency: len(postings), Postings: postings})
	}
	sort.Slice(terms, func(i, j int) bool {
		return terms[i].Term < terms[j].Term
	})
	chunkCount := len(chunks)
	indexData := IndexData{
		Generator:        generatorName,
		SchemaVersion:    schemaVersion,
		Backend:          backendName,
		ChunkCount:       chunkCount,
		AvgContentLength: averageLength(totalContentLength, chunkCount),
		AvgPathLength:    averageLength(totalPathLength, chunkCount),
		AvgSymbolLength:  averageLength(totalSymbolLength, chunkCount),
		Chunks:           chunks,
		Terms:            terms,
	}
	manifest := Manifest{
		Generator:      generatorName,
		SchemaVersion:  schemaVersion,
		RepoRoot:       repo,
		RepoKey:        filepath.Base(final),
		Backend:        backendName,
		IndexedAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Git:            gitState(repo),
		CandidateState: afterState,
		Files:          len(sources),
		Chunks:         chunkCount,
		GraphEdges:     graph.EdgeCount,
		Settings: IndexSettings{
			MaxFileBytes: options.MaxFileBytes,
			ChunkLines:   options.ChunkLines,
			OverlapLines: options.OverlapLines,
			Exclude:      append([]string(nil), options.Exclude...),
		},
	}
	if err := writeGzipJSONFile(filepath.Join(staging, indexFileName), indexData); err != nil {
		return IndexPayload{}, err
	}
	if err := writeJSONFile(filepath.Join(staging, graphFileName), graph); err != nil {
		return IndexPayload{}, err
	}
	if err := writeJSONFile(filepath.Join(staging, manifestFileName), manifest); err != nil {
		return IndexPayload{}, err
	}
	if err := replaceGeneratedCache(staging, final, cacheRoot); err != nil {
		return IndexPayload{}, err
	}
	completed = true
	return IndexPayload{
		Status:        "indexed",
		Repo:          repo,
		Cache:         final,
		Generator:     generatorName,
		SchemaVersion: schemaVersion,
		Backend:       backendName,
		Files:         len(sources),
		Chunks:        chunkCount,
		GraphEdges:    graph.EdgeCount,
	}, nil
}

func sumFrequencies(counts map[string]int) int {
	total := 0
	for _, count := range counts {
		total += count
	}
	return total
}

func averageLength(total int, count int) float64 {
	if count == 0 {
		return 0
	}
	return float64(total) / float64(count)
}

func loadManifest(repo string, cacheRoot string) (string, Manifest, error) {
	cachePath := repoCachePath(repo, cacheRoot)
	manifestPath := filepath.Join(cachePath, manifestFileName)
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", Manifest{}, userError{message: "No code-context index exists. Run the index command for this repository."}
		}
		return "", Manifest{}, userError{message: fmt.Sprintf("Cannot read context manifest: %v", err)}
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return "", Manifest{}, userError{message: fmt.Sprintf("Cannot read context manifest: %v", err)}
	}
	if reason := incompatibleManifestReason(raw, repo, cachePath); reason != "" {
		return "", Manifest{}, userError{message: reason}
	}
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return "", Manifest{}, userError{message: fmt.Sprintf("Cannot decode context manifest: %v", err)}
	}
	if manifest.CandidateState == nil {
		manifest.CandidateState = []PathState{}
	}
	if manifest.Settings.Exclude == nil {
		manifest.Settings.Exclude = []string{}
	}
	return cachePath, manifest, nil
}

func incompatibleManifestReason(raw map[string]any, repo string, cachePath string) string {
	generator, _ := raw["generator"].(string)
	schemaValue, ok := raw["schema_version"].(float64)
	if generator != generatorName || !ok || int(schemaValue) != schemaVersion {
		return "Index format is incompatible; rebuild required."
	}
	repoRoot, _ := raw["repo_root"].(string)
	resolvedRoot, err := filepath.Abs(repoRoot)
	if err != nil || resolvedRoot != repo {
		return "Index belongs to a different repository."
	}
	if !fileExists(filepath.Join(cachePath, indexFileName)) || !fileExists(filepath.Join(cachePath, graphFileName)) {
		return "Index files are incomplete; rebuild required."
	}
	return ""
}

func loadIndex(cachePath string) (IndexData, error) {
	var indexData IndexData
	if err := readGzipJSONFile(filepath.Join(cachePath, indexFileName), &indexData); err != nil {
		return IndexData{}, userError{message: fmt.Sprintf("Cannot read lexical index: %v", err)}
	}
	if indexData.Generator != generatorName || indexData.SchemaVersion != schemaVersion || indexData.Backend != backendName {
		return IndexData{}, userError{message: "Index format is incompatible; rebuild required."}
	}
	if indexData.Chunks == nil {
		indexData.Chunks = []ChunkRecord{}
	}
	if indexData.Terms == nil {
		indexData.Terms = []TermEntry{}
	}
	return indexData, nil
}

func loadGraph(cachePath string) (GraphPayload, error) {
	var graph GraphPayload
	data, err := os.ReadFile(filepath.Join(cachePath, graphFileName))
	if err != nil {
		return GraphPayload{}, userError{message: fmt.Sprintf("Cannot read relationship graph: %v", err)}
	}
	if err := json.Unmarshal(data, &graph); err != nil {
		return GraphPayload{}, userError{message: fmt.Sprintf("Cannot decode relationship graph: %v", err)}
	}
	if graph.Nodes == nil {
		graph.Nodes = map[string]GraphNode{}
	}
	if graph.Outgoing == nil {
		graph.Outgoing = map[string][]GraphEdge{}
	}
	if graph.Incoming == nil {
		graph.Incoming = map[string][]GraphEdge{}
	}
	return graph, nil
}

func indexStaleness(repo string, manifest Manifest) (bool, []string, error) {
	paths, err := discoverPaths(repo, manifest.Settings.Exclude)
	if err != nil {
		return false, nil, err
	}
	currentState := candidateState(repo, paths)
	reasons := make([]string, 0)
	if !reflect.DeepEqual(currentState, manifest.CandidateState) {
		reasons = append(reasons, "Git-visible file size or timestamp changed")
	}
	if gitState(repo) != manifest.Git {
		reasons = append(reasons, "Git HEAD or worktree state changed")
	}
	return len(reasons) > 0, reasons, nil
}

func bm25(tf int, df float64, docLength float64, avgLength float64, totalDocs float64) float64 {
	if tf <= 0 || avgLength <= 0 || totalDocs <= 0 || df <= 0 {
		return 0
	}
	idf := math.Log1p((totalDocs - df + 0.5) / (df + 0.5))
	termFrequency := float64(tf)
	denominator := termFrequency + bm25K1*(1-bm25B+bm25B*(docLength/avgLength))
	if denominator == 0 {
		return 0
	}
	return idf * ((termFrequency * (bm25K1 + 1)) / denominator)
}

func pathExactMatch(pathValue string, query string) bool {
	query = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(query), "\\", "/"))
	if query == "" {
		return false
	}
	if strings.Contains(strings.ToLower(pathValue), query) {
		return true
	}
	base := strings.TrimSuffix(strings.ToLower(path.Base(pathValue)), strings.ToLower(path.Ext(pathValue)))
	return canonicalIdentifier(base) == canonicalIdentifier(query)
}

func symbolExactMatch(symbols []string, query string) bool {
	queryID := canonicalIdentifier(query)
	if queryID == "" {
		return false
	}
	for _, symbol := range symbols {
		if canonicalIdentifier(symbol) == queryID {
			return true
		}
	}
	return false
}

func searchIndex(options SearchOptions) (SearchPayload, error) {
	query := strings.TrimSpace(options.Query)
	if query == "" {
		return SearchPayload{}, userError{message: "Search query cannot be empty."}
	}
	if options.TopK <= 0 {
		return SearchPayload{}, userError{message: "--top-k must be greater than zero."}
	}
	if options.Neighbors <= 0 {
		options.Neighbors = defaultSearchNeighbors
	}
	repo, err := resolveRepoRoot(options.Repo)
	if err != nil {
		return SearchPayload{}, err
	}
	cacheRoot, err := cacheRootFrom(options.CacheDir)
	if err != nil {
		return SearchPayload{}, err
	}
	if err := ensureExternalCache(repo, cacheRoot); err != nil {
		return SearchPayload{}, err
	}
	cachePath, manifest, err := loadManifest(repo, cacheRoot)
	if err != nil {
		return SearchPayload{}, err
	}
	indexData, err := loadIndex(cachePath)
	if err != nil {
		return SearchPayload{}, err
	}
	graph, err := loadGraph(cachePath)
	if err != nil {
		return SearchPayload{}, err
	}
	stale, reasons, err := indexStaleness(repo, manifest)
	if err != nil {
		return SearchPayload{}, err
	}
	queryCounts := countTokens(tokenizeText(query))
	if len(queryCounts) == 0 {
		return SearchPayload{}, userError{message: "Search query needs at least one letter or number."}
	}
	termMap := make(map[string]TermEntry, len(indexData.Terms))
	for _, entry := range indexData.Terms {
		termMap[entry.Term] = entry
	}
	totalDocs := float64(len(indexData.Chunks))
	scoreByChunk := map[int]float64{}
	for term, queryFrequency := range queryCounts {
		entry, ok := termMap[term]
		if !ok {
			continue
		}
		queryWeight := 1.0 + math.Log(float64(queryFrequency))
		df := float64(entry.DocumentFrequency)
		for _, posting := range entry.Postings {
			chunk := indexData.Chunks[posting.Chunk]
			score := bm25(posting.ContentTF, df, float64(chunk.ContentLength), indexData.AvgContentLength, totalDocs)
			score += pathBoost * bm25(posting.PathTF, df, float64(chunk.PathLength), indexData.AvgPathLength, totalDocs)
			score += symbolBoost * bm25(posting.SymbolTF, df, float64(chunk.SymbolLength), indexData.AvgSymbolLength, totalDocs)
			if score > 0 {
				scoreByChunk[posting.Chunk] += queryWeight * score
			}
		}
	}
	lowerQuery := strings.ToLower(query)
	for chunkIndex, score := range scoreByChunk {
		chunk := indexData.Chunks[chunkIndex]
		if pathExactMatch(chunk.Path, lowerQuery) {
			score += exactPathBoost
		}
		if symbolExactMatch(chunk.Symbols, query) {
			score += exactSymbolBoost
		}
		scoreByChunk[chunkIndex] = score
	}
	type rankedChunk struct {
		ChunkIndex int
		Score      float64
	}
	ranked := make([]rankedChunk, 0, len(scoreByChunk))
	for chunkIndex, score := range scoreByChunk {
		ranked = append(ranked, rankedChunk{ChunkIndex: chunkIndex, Score: score})
	}
	sort.Slice(ranked, func(i, j int) bool {
		if ranked[i].Score == ranked[j].Score {
			left := indexData.Chunks[ranked[i].ChunkIndex]
			right := indexData.Chunks[ranked[j].ChunkIndex]
			if left.Path == right.Path {
				return left.StartLine < right.StartLine
			}
			return left.Path < right.Path
		}
		return ranked[i].Score > ranked[j].Score
	})
	if len(ranked) > options.TopK {
		ranked = ranked[:options.TopK]
	}
	results := make([]SearchHit, 0, len(ranked))
	for index, item := range ranked {
		chunk := indexData.Chunks[item.ChunkIndex]
		results = append(results, SearchHit{
			Rank:         index + 1,
			Score:        item.Score,
			Path:         chunk.Path,
			ChunkPath:    chunk.ChunkPath,
			StartLine:    chunk.StartLine,
			EndLine:      chunk.EndLine,
			Language:     chunk.Language,
			Kind:         chunk.Kind,
			Symbols:      append([]string(nil), chunk.Symbols...),
			ContentHash:  chunk.ContentHash,
			Snippet:      chunk.Snippet,
			Content:      chunk.Content,
			RelatedFiles: relatedPaths(graph, chunk.Path, options.Neighbors),
		})
	}
	return SearchPayload{
		Query:         query,
		Repo:          repo,
		Cache:         cachePath,
		Generator:     generatorName,
		SchemaVersion: schemaVersion,
		Backend:       backendName,
		Stale:         stale,
		StaleReasons:  reasons,
		Results:       results,
	}, nil
}

func normalizeRequestedPath(repo string, requested string) (string, error) {
	expanded := expandUserPath(requested)
	if filepath.IsAbs(expanded) {
		absolutePath := filepath.Clean(expanded)
		relativePath, err := filepath.Rel(repo, absolutePath)
		if err != nil {
			return "", userError{message: fmt.Sprintf("Path is outside the repository: %s", requested)}
		}
		relativePath = normalizeRepoPath(filepath.ToSlash(relativePath))
		if relativePath == "" {
			return "", userError{message: fmt.Sprintf("Path is outside the repository: %s", requested)}
		}
		return relativePath, nil
	}
	relativePath := normalizeRepoPath(filepath.ToSlash(expanded))
	if relativePath == "" {
		return "", userError{message: fmt.Sprintf("Path is outside the repository: %s", requested)}
	}
	return relativePath, nil
}

func relatedIndex(options RelatedOptions) (RelatedPayload, error) {
	if options.TopK <= 0 {
		return RelatedPayload{}, userError{message: "--top-k must be greater than zero."}
	}
	repo, err := resolveRepoRoot(options.Repo)
	if err != nil {
		return RelatedPayload{}, err
	}
	cacheRoot, err := cacheRootFrom(options.CacheDir)
	if err != nil {
		return RelatedPayload{}, err
	}
	if err := ensureExternalCache(repo, cacheRoot); err != nil {
		return RelatedPayload{}, err
	}
	cachePath, manifest, err := loadManifest(repo, cacheRoot)
	if err != nil {
		return RelatedPayload{}, err
	}
	graph, err := loadGraph(cachePath)
	if err != nil {
		return RelatedPayload{}, err
	}
	requestedPath, err := normalizeRequestedPath(repo, options.Path)
	if err != nil {
		return RelatedPayload{}, err
	}
	node, ok := graph.Nodes[requestedPath]
	if !ok {
		return RelatedPayload{}, userError{message: fmt.Sprintf("Path is not present in the context graph: %s", requestedPath)}
	}
	stale, reasons, err := indexStaleness(repo, manifest)
	if err != nil {
		return RelatedPayload{}, err
	}
	return RelatedPayload{
		Repo:          repo,
		Cache:         cachePath,
		Path:          requestedPath,
		Generator:     generatorName,
		SchemaVersion: schemaVersion,
		Backend:       backendName,
		Stale:         stale,
		StaleReasons:  reasons,
		Node:          node,
		RelatedFiles:  relatedPaths(graph, requestedPath, options.TopK),
	}, nil
}

func statusIndex(options StatusOptions) (StatusPayload, error) {
	repo, err := resolveRepoRoot(options.Repo)
	if err != nil {
		return StatusPayload{}, err
	}
	cacheRoot, err := cacheRootFrom(options.CacheDir)
	if err != nil {
		return StatusPayload{}, err
	}
	if err := ensureExternalCache(repo, cacheRoot); err != nil {
		return StatusPayload{}, err
	}
	cachePath := repoCachePath(repo, cacheRoot)
	payload := StatusPayload{
		Repo:         repo,
		Cache:        cachePath,
		Fresh:        false,
		StaleReasons: []string{},
		Runtime:      "go-stdlib",
		RuntimeReady: true,
	}
	manifestPath := filepath.Join(cachePath, manifestFileName)
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			payload.Status = "missing"
			return payload, nil
		}
		return StatusPayload{}, userError{message: fmt.Sprintf("Cannot read context manifest: %v", err)}
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return StatusPayload{}, userError{message: fmt.Sprintf("Cannot read context manifest: %v", err)}
	}
	if reason := incompatibleManifestReason(raw, repo, cachePath); reason != "" {
		payload.Status = "stale"
		payload.StaleReasons = []string{reason}
		return payload, nil
	}
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return StatusPayload{}, userError{message: fmt.Sprintf("Cannot decode context manifest: %v", err)}
	}
	stale, reasons, err := indexStaleness(repo, manifest)
	if err != nil {
		return StatusPayload{}, err
	}
	payload.Status = "ready"
	if stale {
		payload.Status = "stale"
	}
	payload.Fresh = !stale
	payload.StaleReasons = reasons
	payload.Generator = manifest.Generator
	payload.SchemaVersion = manifest.SchemaVersion
	payload.Backend = manifest.Backend
	payload.IndexedAt = manifest.IndexedAt
	payload.Files = manifest.Files
	payload.Chunks = manifest.Chunks
	payload.GraphEdges = manifest.GraphEdges
	return payload, nil
}

func printJSON(output io.Writer, payload any) error {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(output, string(data))
	return err
}

func printHuman(output io.Writer, payload any) error {
	switch value := payload.(type) {
	case IndexPayload:
		_, err := fmt.Fprintf(output, "Indexed %d files into %d chunks with %d graph edges.\nCache: %s\n", value.Files, value.Chunks, value.GraphEdges, value.Cache)
		return err
	case SearchPayload:
		state := "fresh"
		if value.Stale {
			state = "stale"
		}
		if _, err := fmt.Fprintf(output, "Index: %s (%s)\n", value.Backend, state); err != nil {
			return err
		}
		for _, reason := range value.StaleReasons {
			if _, err := fmt.Fprintf(output, "Warning: %s\n", reason); err != nil {
				return err
			}
		}
		if len(value.Results) == 0 {
			_, err := fmt.Fprintln(output, "No matching context found.")
			return err
		}
		for _, hit := range value.Results {
			if _, err := fmt.Fprintf(output, "\n%d. %s:%d-%d score=%.4f\n", hit.Rank, hit.Path, hit.StartLine, hit.EndLine, hit.Score); err != nil {
				return err
			}
			if len(hit.Symbols) > 0 {
				if _, err := fmt.Fprintf(output, "   Symbols: %s\n", strings.Join(hit.Symbols, ", ")); err != nil {
					return err
				}
			}
			if len(hit.RelatedFiles) > 0 {
				related := make([]string, 0, len(hit.RelatedFiles))
				for _, item := range hit.RelatedFiles {
					related = append(related, item.Path)
				}
				if _, err := fmt.Fprintf(output, "   Related: %s\n", strings.Join(related, ", ")); err != nil {
					return err
				}
			}
			if _, err := fmt.Fprintln(output, hit.Snippet); err != nil {
				return err
			}
		}
		return nil
	case RelatedPayload:
		state := "fresh"
		if value.Stale {
			state = "stale"
		}
		if _, err := fmt.Fprintf(output, "Index: %s (%s)\nPath: %s\n", value.Backend, state, value.Path); err != nil {
			return err
		}
		for _, reason := range value.StaleReasons {
			if _, err := fmt.Fprintf(output, "Warning: %s\n", reason); err != nil {
				return err
			}
		}
		if len(value.RelatedFiles) == 0 {
			_, err := fmt.Fprintln(output, "No related files found.")
			return err
		}
		for index, item := range value.RelatedFiles {
			if _, err := fmt.Fprintf(output, "%d. %s (%s)\n", index+1, item.Path, strings.Join(item.Relations, ", ")); err != nil {
				return err
			}
		}
		return nil
	case StatusPayload:
		if _, err := fmt.Fprintf(output, "Status: %s\nCache: %s\n", value.Status, value.Cache); err != nil {
			return err
		}
		if value.IndexedAt != "" {
			if _, err := fmt.Fprintf(output, "Indexed: %s\n", value.IndexedAt); err != nil {
				return err
			}
		}
		if value.Files > 0 || value.Chunks > 0 || value.GraphEdges > 0 {
			if _, err := fmt.Fprintf(output, "Files: %d  Chunks: %d  Graph edges: %d\n", value.Files, value.Chunks, value.GraphEdges); err != nil {
				return err
			}
		}
		for _, reason := range value.StaleReasons {
			if _, err := fmt.Fprintf(output, "Reason: %s\n", reason); err != nil {
				return err
			}
		}
		return nil
	default:
		return printJSON(output, payload)
	}
}

func printUsage(output io.Writer) {
	fmt.Fprintln(output, "Usage:")
	fmt.Fprintln(output, "  code_context.go index [--repo PATH] [--cache-dir PATH] [--chunk-lines N] [--overlap-lines N] [--max-file-bytes N] [--exclude GLOB] [--json]")
	fmt.Fprintln(output, "  code_context.go search QUERY [--repo PATH] [--cache-dir PATH] [--top-k N] [--neighbors N] [--json]")
	fmt.Fprintln(output, "  code_context.go related PATH [--repo PATH] [--cache-dir PATH] [--top-k N] [--limit N] [--json]")
	fmt.Fprintln(output, "  code_context.go status [--repo PATH] [--cache-dir PATH] [--json]")
}

func splitFlag(argument string) (string, string, bool) {
	if index := strings.IndexByte(argument, '='); index >= 0 {
		return argument[:index], argument[index+1:], true
	}
	return argument, "", false
}

func consumeFlagValue(arguments []string, index *int, name string, inline string, hasInline bool) (string, error) {
	if hasInline {
		if inline == "" {
			return "", userError{message: fmt.Sprintf("%s needs a value.", name)}
		}
		return inline, nil
	}
	if *index+1 >= len(arguments) {
		return "", userError{message: fmt.Sprintf("%s needs a value.", name)}
	}
	*index++
	return arguments[*index], nil
}

func parsePositiveIntFlag(name string, value string) (int, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, userError{message: fmt.Sprintf("%s must be greater than zero.", name)}
	}
	return parsed, nil
}

func parsePositiveInt64Flag(name string, value string) (int64, error) {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, userError{message: fmt.Sprintf("%s must be greater than zero.", name)}
	}
	return parsed, nil
}

func parseNonNegativeIntFlag(name string, value string) (int, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0, userError{message: fmt.Sprintf("%s must be zero or greater.", name)}
	}
	return parsed, nil
}

func parseIndexArgs(arguments []string) (IndexOptions, bool, error) {
	options := IndexOptions{Repo: ".", MaxFileBytes: defaultMaxFileBytes, ChunkLines: defaultChunkLines, OverlapLines: defaultOverlapLines}
	jsonOutput := false
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if argument == "-h" || argument == "--help" {
			return options, jsonOutput, helpRequest{command: "index"}
		}
		if argument == "--" {
			if index+1 < len(arguments) {
				return options, jsonOutput, userError{message: "index does not accept positional arguments."}
			}
			break
		}
		if !strings.HasPrefix(argument, "--") {
			return options, jsonOutput, userError{message: "index does not accept positional arguments."}
		}
		name, inline, hasInline := splitFlag(argument)
		switch name {
		case "--repo":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Repo = value
		case "--cache-dir":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.CacheDir = value
		case "--max-file-bytes":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parsePositiveInt64Flag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.MaxFileBytes = parsed
		case "--chunk-lines":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parsePositiveIntFlag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.ChunkLines = parsed
		case "--overlap-lines":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parseNonNegativeIntFlag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.OverlapLines = parsed
		case "--exclude":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Exclude = append(options.Exclude, value)
		case "--json":
			if hasInline {
				return options, jsonOutput, userError{message: "--json does not take a value."}
			}
			jsonOutput = true
		default:
			return options, jsonOutput, userError{message: fmt.Sprintf("Unknown flag for index: %s", name)}
		}
	}
	return options, jsonOutput, nil
}

func parseSearchArgs(arguments []string) (SearchOptions, bool, error) {
	options := SearchOptions{Repo: ".", TopK: defaultSearchTopK, Neighbors: defaultSearchNeighbors}
	jsonOutput := false
	positionals := make([]string, 0)
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if argument == "-h" || argument == "--help" {
			return options, jsonOutput, helpRequest{command: "search"}
		}
		if argument == "--" {
			positionals = append(positionals, arguments[index+1:]...)
			break
		}
		if !strings.HasPrefix(argument, "--") {
			positionals = append(positionals, argument)
			continue
		}
		name, inline, hasInline := splitFlag(argument)
		switch name {
		case "--repo":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Repo = value
		case "--cache-dir":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.CacheDir = value
		case "--top-k":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parsePositiveIntFlag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.TopK = parsed
		case "--neighbors":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parsePositiveIntFlag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Neighbors = parsed
		case "--json":
			if hasInline {
				return options, jsonOutput, userError{message: "--json does not take a value."}
			}
			jsonOutput = true
		default:
			return options, jsonOutput, userError{message: fmt.Sprintf("Unknown flag for search: %s", name)}
		}
	}
	options.Query = strings.TrimSpace(strings.Join(positionals, " "))
	if options.Query == "" {
		return options, jsonOutput, userError{message: "search requires a query."}
	}
	return options, jsonOutput, nil
}

func parseRelatedArgs(arguments []string) (RelatedOptions, bool, error) {
	options := RelatedOptions{Repo: ".", TopK: defaultRelatedTopK}
	jsonOutput := false
	positionals := make([]string, 0, 1)
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if argument == "-h" || argument == "--help" {
			return options, jsonOutput, helpRequest{command: "related"}
		}
		if argument == "--" {
			positionals = append(positionals, arguments[index+1:]...)
			break
		}
		if !strings.HasPrefix(argument, "--") {
			positionals = append(positionals, argument)
			continue
		}
		name, inline, hasInline := splitFlag(argument)
		switch name {
		case "--repo":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Repo = value
		case "--cache-dir":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.CacheDir = value
		case "--top-k", "--limit":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			parsed, err := parsePositiveIntFlag(name, value)
			if err != nil {
				return options, jsonOutput, err
			}
			options.TopK = parsed
		case "--json":
			if hasInline {
				return options, jsonOutput, userError{message: "--json does not take a value."}
			}
			jsonOutput = true
		default:
			return options, jsonOutput, userError{message: fmt.Sprintf("Unknown flag for related: %s", name)}
		}
	}
	if len(positionals) != 1 {
		return options, jsonOutput, userError{message: "related requires exactly one repository path."}
	}
	options.Path = positionals[0]
	return options, jsonOutput, nil
}

func parseStatusArgs(arguments []string) (StatusOptions, bool, error) {
	options := StatusOptions{Repo: "."}
	jsonOutput := false
	for index := 0; index < len(arguments); index++ {
		argument := arguments[index]
		if argument == "-h" || argument == "--help" {
			return options, jsonOutput, helpRequest{command: "status"}
		}
		if argument == "--" {
			if index+1 < len(arguments) {
				return options, jsonOutput, userError{message: "status does not accept positional arguments."}
			}
			break
		}
		if !strings.HasPrefix(argument, "--") {
			return options, jsonOutput, userError{message: "status does not accept positional arguments."}
		}
		name, inline, hasInline := splitFlag(argument)
		switch name {
		case "--repo":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.Repo = value
		case "--cache-dir":
			value, err := consumeFlagValue(arguments, &index, name, inline, hasInline)
			if err != nil {
				return options, jsonOutput, err
			}
			options.CacheDir = value
		case "--json":
			if hasInline {
				return options, jsonOutput, userError{message: "--json does not take a value."}
			}
			jsonOutput = true
		default:
			return options, jsonOutput, userError{message: fmt.Sprintf("Unknown flag for status: %s", name)}
		}
	}
	return options, jsonOutput, nil
}

func runCLI(arguments []string, output io.Writer, errorOutput io.Writer) int {
	if len(arguments) == 0 {
		printUsage(errorOutput)
		return 2
	}
	command := arguments[0]
	if command == "-h" || command == "--help" {
		printUsage(output)
		return 0
	}
	var (
		payload    any
		jsonOutput bool
		err        error
	)
	switch command {
	case "index":
		var options IndexOptions
		options, jsonOutput, err = parseIndexArgs(arguments[1:])
		if err == nil {
			payload, err = buildIndex(options)
		}
	case "search":
		var options SearchOptions
		options, jsonOutput, err = parseSearchArgs(arguments[1:])
		if err == nil {
			payload, err = searchIndex(options)
		}
	case "related":
		var options RelatedOptions
		options, jsonOutput, err = parseRelatedArgs(arguments[1:])
		if err == nil {
			payload, err = relatedIndex(options)
		}
	case "status":
		var options StatusOptions
		options, jsonOutput, err = parseStatusArgs(arguments[1:])
		if err == nil {
			payload, err = statusIndex(options)
		}
	default:
		fmt.Fprintf(errorOutput, "error: unknown command %q\n", command)
		printUsage(errorOutput)
		return 2
	}
	if err != nil {
		if help, ok := err.(helpRequest); ok {
			_ = help
			printUsage(output)
			return 0
		}
		fmt.Fprintf(errorOutput, "error: %v\n", err)
		return 2
	}
	if jsonOutput {
		if err := printJSON(output, payload); err != nil {
			fmt.Fprintf(errorOutput, "error: %v\n", err)
			return 2
		}
		return 0
	}
	if err := printHuman(output, payload); err != nil {
		fmt.Fprintf(errorOutput, "error: %v\n", err)
		return 2
	}
	return 0
}

func main() {
	os.Exit(runCLI(os.Args[1:], os.Stdout, os.Stderr))
}
