package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func skillDir(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not determine test file path")
	}
	return filepath.Dir(file)
}

func repoRoot(t *testing.T) string {
	t.Helper()
	return filepath.Clean(filepath.Join(skillDir(t), "..", "..", ".."))
}

func newWorkspace(t *testing.T) string {
	t.Helper()
	base := filepath.Join(skillDir(t), ".test-work")
	if err := os.MkdirAll(base, 0o755); err != nil {
		t.Fatalf("create test base: %v", err)
	}
	workspace := filepath.Join(base, sanitizeSlug(strings.ReplaceAll(t.Name(), "/", "-"))+"-"+time.Now().UTC().Format("20060102T150405.000000000"))
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(workspace)
		_ = os.Remove(base)
	})
	return workspace
}

func mustMkdirAll(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
}

func writeFile(t *testing.T, filePath string, content string) {
	t.Helper()
	mustMkdirAll(t, filepath.Dir(filePath))
	if err := os.WriteFile(filePath, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", filePath, err)
	}
}

func writeBytes(t *testing.T, filePath string, content []byte) {
	t.Helper()
	mustMkdirAll(t, filepath.Dir(filePath))
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		t.Fatalf("write %s: %v", filePath, err)
	}
}

func runGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	commandArgs := append([]string{"-C", dir}, args...)
	cmd := exec.Command("git", commandArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v failed: %v\n%s", args, err, string(output))
	}
	return string(output)
}

func initGitRepo(t *testing.T, workspace string) string {
	t.Helper()
	repo := filepath.Join(workspace, "repo")
	mustMkdirAll(t, repo)
	runGit(t, repo, "init", "-q")
	return repo
}

func commitAll(t *testing.T, repo string, message string) {
	t.Helper()
	runGit(t, repo, "config", "user.email", "copilot@example.com")
	runGit(t, repo, "config", "user.name", "Copilot")
	runGit(t, repo, "config", "commit.gpgsign", "false")
	runGit(t, repo, "add", ".")
	runGit(t, repo, "-c", "commit.gpgsign=false", "commit", "-qm", message)
}

func envWithOverrides(base []string, overrides map[string]string) []string {
	envMap := make(map[string]string, len(base)+len(overrides))
	for _, item := range base {
		parts := strings.SplitN(item, "=", 2)
		if len(parts) == 2 {
			envMap[parts[0]] = parts[1]
		}
	}
	for key, value := range overrides {
		envMap[key] = value
	}
	result := make([]string, 0, len(envMap))
	for key, value := range envMap {
		result = append(result, key+"="+value)
	}
	return result
}

func runGoCLI(t *testing.T, workspace string, args ...string) (string, error) {
	t.Helper()
	gocache := filepath.Join(workspace, "gocache")
	gotmp := filepath.Join(workspace, "gotmp")
	mustMkdirAll(t, gocache)
	mustMkdirAll(t, gotmp)
	commandArgs := append([]string{"run", "."}, args...)
	cmd := exec.Command("go", commandArgs...)
	cmd.Dir = skillDir(t)
	cmd.Env = envWithOverrides(os.Environ(), map[string]string{
		"GOFLAGS":  "",
		"GOCACHE":  gocache,
		"GOTMPDIR": gotmp,
	})
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func TestCachePathAndRepoLocalCacheRejection(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	path := repoCachePath(repo, cache)
	if filepath.Dir(path) != cache {
		t.Fatalf("cache parent mismatch: got %s want %s", filepath.Dir(path), cache)
	}
	if path == repo || pathWithin(repo, path) {
		t.Fatalf("repo cache path should stay outside repository: %s", path)
	}
	if err := ensureExternalCache(repo, filepath.Join(repo, ".context")); err == nil {
		t.Fatal("expected repository-local cache to be rejected")
	}
}

func TestDiscoverPathsUsesGitAndFilesystemFallback(t *testing.T) {
	t.Run("git", func(t *testing.T) {
		workspace := newWorkspace(t)
		repo := initGitRepo(t, workspace)
		writeFile(t, filepath.Join(repo, ".gitignore"), "ignored.txt\n")
		writeFile(t, filepath.Join(repo, "main.py"), "print('safe')\n")
		writeFile(t, filepath.Join(repo, "ignored.txt"), "ignored\n")
		writeFile(t, filepath.Join(repo, ".env"), "TOKEN=secret\n")
		writeFile(t, filepath.Join(repo, "vendor", "dep.js"), "export const dep = 1\n")

		paths, err := discoverPaths(repo, nil)
		if err != nil {
			t.Fatalf("discover paths: %v", err)
		}
		joined := strings.Join(paths, "\n")
		if !strings.Contains(joined, ".gitignore") || !strings.Contains(joined, "main.py") {
			t.Fatalf("expected safe files in discovery: %v", paths)
		}
		if strings.Contains(joined, "ignored.txt") || strings.Contains(joined, ".env") || strings.Contains(joined, "vendor/dep.js") {
			t.Fatalf("unexpected skipped file present: %v", paths)
		}
	})

	t.Run("fallback", func(t *testing.T) {
		workspace := newWorkspace(t)
		dir := filepath.Join(workspace, "plain")
		mustMkdirAll(t, filepath.Join(dir, "node_modules"))
		writeFile(t, filepath.Join(dir, "app.js"), "export const ok = true\n")
		writeFile(t, filepath.Join(dir, "node_modules", "dep.js"), "ignored\n")

		paths, err := discoverPaths(dir, nil)
		if err != nil {
			t.Fatalf("fallback discover paths: %v", err)
		}
		if len(paths) != 1 || paths[0] != "app.js" {
			t.Fatalf("unexpected fallback discovery result: %v", paths)
		}
	})
}

func TestCLIRejectsRepositoryLocalCachePath(t *testing.T) {
	t.Run("direct", func(t *testing.T) {
		workspace := newWorkspace(t)
		repo := initGitRepo(t, workspace)
		writeFile(t, filepath.Join(repo, "main.go"), "package main\n")

		output, err := runGoCLI(t, workspace, "index", "--repo", repo, "--cache-dir", filepath.Join(repo, ".context"))
		if err == nil {
			t.Fatalf("expected repository-local cache rejection, got success with output: %s", output)
		}
		if !strings.Contains(output, "The context cache must be outside the repository") {
			t.Fatalf("expected cache rejection message, got: %s", output)
		}
		if fileExists(filepath.Join(repo, ".context")) {
			t.Fatal("repository-local cache directory should not be created")
		}
	})

	t.Run("symlink-alias", func(t *testing.T) {
		workspace := newWorkspace(t)
		realRepo := filepath.Join(workspace, "real", "repo")
		mustMkdirAll(t, realRepo)
		runGit(t, realRepo, "init", "-q")
		writeFile(t, filepath.Join(realRepo, "main.go"), "package main\n")

		aliasRoot := filepath.Join(workspace, "alias")
		if err := os.Symlink(filepath.Join(workspace, "real"), aliasRoot); err != nil {
			lowered := strings.ToLower(err.Error())
			if runtime.GOOS == "windows" || strings.Contains(lowered, "not permitted") || strings.Contains(lowered, "privilege") {
				t.Skipf("symlink creation unavailable: %v", err)
			}
			t.Fatalf("create symlink alias: %v", err)
		}
		repoViaAlias := filepath.Join(aliasRoot, "repo")
		cacheViaAlias := filepath.Join(repoViaAlias, ".context")

		output, err := runGoCLI(t, workspace, "index", "--repo", repoViaAlias, "--cache-dir", cacheViaAlias)
		if err == nil {
			t.Fatalf("expected symlinked repository-local cache rejection, got success with output: %s", output)
		}
		if !strings.Contains(output, "The context cache must be outside the repository") {
			t.Fatalf("expected cache rejection message, got: %s", output)
		}
		if fileExists(filepath.Join(realRepo, ".context")) || fileExists(cacheViaAlias) {
			t.Fatal("repository-local cache directory should not be created through a symlink alias")
		}
	})
}

func TestBuildIndexSkipsBinaryOversizeSecretsAndSymlinks(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	writeFile(t, filepath.Join(repo, "main.py"), "def hello():\n    return 'ok'\n")
	writeBytes(t, filepath.Join(repo, "binary.dat"), []byte{'a', 0, 'b'})
	writeFile(t, filepath.Join(repo, "large.txt"), strings.Repeat("x", 128))
	writeFile(t, filepath.Join(repo, ".env"), "TOKEN=secret\n")
	writeFile(t, filepath.Join(repo, "vendor", "dep.js"), "export const dep = 1\n")
	if err := os.Symlink(filepath.Join(repo, "main.py"), filepath.Join(repo, "link.py")); err != nil && !strings.Contains(strings.ToLower(err.Error()), "not permitted") {
		t.Fatalf("create symlink: %v", err)
	}

	payload, err := buildIndex(IndexOptions{Repo: repo, CacheDir: cache, MaxFileBytes: 64, ChunkLines: 20, OverlapLines: 2})
	if err != nil {
		t.Fatalf("build index: %v", err)
	}
	if payload.Files != 1 {
		t.Fatalf("expected exactly one indexed file, got %d", payload.Files)
	}
	search, err := searchIndex(SearchOptions{Repo: repo, CacheDir: cache, Query: "hello", TopK: 5, Neighbors: 3})
	if err != nil {
		t.Fatalf("search index: %v", err)
	}
	if len(search.Results) == 0 || search.Results[0].Path != "main.py" {
		t.Fatalf("unexpected search results: %+v", search.Results)
	}
}

func TestChunksCarryRangesAndSymbols(t *testing.T) {
	text := "class First:\n    pass\n\nasync def refresh_token():\n    return 1\n\ndef second():\n    return 2\n"
	source := SourceFile{
		Path:     "sample.py",
		Text:     text,
		Language: "python",
		Kind:     "code",
		Symbols:  extractSymbols(text, "python"),
		Size:     int64(len(text)),
		MTimeNS:  1,
	}
	chunks := chunksFor(source, 3, 1)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	if chunks[0].StartLine != 1 {
		t.Fatalf("unexpected first chunk start: %d", chunks[0].StartLine)
	}
	if chunks[1].StartLine > chunks[0].EndLine {
		t.Fatalf("expected overlap between chunks: %+v", chunks)
	}
	if len(chunks[0].Symbols) == 0 || chunks[0].ID == "" || chunks[0].ChunkPath == "" {
		t.Fatalf("missing chunk metadata: %+v", chunks[0])
	}
}

func TestGraphResolvesCrossLanguageEdges(t *testing.T) {
	ctx := projectContext{
		knownPaths: map[string]struct{}{
			"app/main.py":      {},
			"pkg/helper.py":    {},
			"docs/guide.md":    {},
			"scripts/setup.sh": {},
			"shared/env.sh":    {},
			"src/main.c":       {},
			"include/util.h":   {},
			"cmd/app/main.go":  {},
			"pkg/util/util.go": {},
			"src/main.rs":      {},
			"src/util.rs":      {},
		},
		goModulePath: "example.com/demo",
		goPackageFiles: map[string][]string{
			"pkg/util": {"pkg/util/util.go"},
		},
	}
	sources := []SourceFile{
		{Path: "app/main.py", Text: "from pkg import helper\n", Language: "python", Kind: "code"},
		{Path: "pkg/helper.py", Text: "def helper():\n    return 1\n", Language: "python", Kind: "code"},
		{Path: "docs/guide.md", Text: "[Helper](../pkg/helper.py)\n", Language: "markdown", Kind: "docs"},
		{Path: "scripts/setup.sh", Text: ". ../shared/env.sh\n", Language: "shell", Kind: "code"},
		{Path: "shared/env.sh", Text: "export APP_ENV=test\n", Language: "shell", Kind: "code"},
		{Path: "src/main.c", Text: "#include \"../include/util.h\"\n", Language: "c", Kind: "code"},
		{Path: "include/util.h", Text: "#define UTIL 1\n", Language: "c", Kind: "code"},
		{Path: "cmd/app/main.go", Text: "package main\nimport \"example.com/demo/pkg/util\"\n", Language: "go", Kind: "code"},
		{Path: "pkg/util/util.go", Text: "package util\nfunc Help() {}\n", Language: "go", Kind: "code", Symbols: extractSymbols("package util\nfunc Help() {}\n", "go")},
		{Path: "src/main.rs", Text: "mod util;\nuse crate::util::helper;\n", Language: "rust", Kind: "code"},
		{Path: "src/util.rs", Text: "pub fn helper() {}\n", Language: "rust", Kind: "code"},
	}
	var edges []relation
	for _, source := range sources {
		edges = append(edges, extractReferenceEdges(source, ctx)...)
	}
	graph := graphPayloadFor(sources, edges)
	assertHasEdge := func(source string, target string, kind string) {
		t.Helper()
		for _, edge := range graph.Outgoing[source] {
			if edge.Path == target && edge.Kind == kind {
				return
			}
		}
		t.Fatalf("missing edge %s -> %s (%s)", source, target, kind)
	}
	assertHasEdge("app/main.py", "pkg/helper.py", "imports")
	assertHasEdge("docs/guide.md", "pkg/helper.py", "links")
	assertHasEdge("scripts/setup.sh", "shared/env.sh", "sources")
	assertHasEdge("src/main.c", "include/util.h", "includes")
	assertHasEdge("cmd/app/main.go", "pkg/util/util.go", "imports")
	assertHasEdge("src/main.rs", "src/util.rs", "modules")
	assertHasEdge("src/main.rs", "src/util.rs", "uses")
	related := relatedPaths(graph, "src/util.rs", 10)
	if len(related) == 0 || related[0].Path != "src/main.rs" {
		t.Fatalf("unexpected related paths: %+v", related)
	}
}

func TestStatusReportsFreshnessChanges(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	writeFile(t, filepath.Join(repo, "main.py"), "print('one')\n")
	commitAll(t, repo, "init")
	if _, err := buildIndex(IndexOptions{Repo: repo, CacheDir: cache, MaxFileBytes: defaultMaxFileBytes, ChunkLines: defaultChunkLines, OverlapLines: defaultOverlapLines}); err != nil {
		t.Fatalf("build index: %v", err)
	}
	ready, err := statusIndex(StatusOptions{Repo: repo, CacheDir: cache})
	if err != nil {
		t.Fatalf("status ready: %v", err)
	}
	if ready.Status != "ready" || !ready.Fresh {
		t.Fatalf("expected ready status, got %+v", ready)
	}
	time.Sleep(5 * time.Millisecond)
	writeFile(t, filepath.Join(repo, "main.py"), "print('two')\n")
	stale, err := statusIndex(StatusOptions{Repo: repo, CacheDir: cache})
	if err != nil {
		t.Fatalf("status stale: %v", err)
	}
	if stale.Status != "stale" || stale.Fresh || len(stale.StaleReasons) == 0 {
		t.Fatalf("expected stale status, got %+v", stale)
	}
}

func TestReplaceGeneratedCachePreservesUnrelatedSiblings(t *testing.T) {
	workspace := newWorkspace(t)
	cacheRoot := filepath.Join(workspace, "cache")
	mustMkdirAll(t, cacheRoot)
	final := filepath.Join(cacheRoot, "repo-cache")
	staging := filepath.Join(cacheRoot, "repo-cache.staging")
	other := filepath.Join(cacheRoot, "other-cache")
	writeFile(t, filepath.Join(final, "manifest.json"), `{"old":true}`)
	writeFile(t, filepath.Join(staging, "manifest.json"), `{"new":true}`)
	writeFile(t, filepath.Join(other, "keep.txt"), "keep\n")
	if err := replaceGeneratedCache(staging, final, cacheRoot); err != nil {
		t.Fatalf("replace cache: %v", err)
	}
	content, err := os.ReadFile(filepath.Join(final, "manifest.json"))
	if err != nil {
		t.Fatalf("read final manifest: %v", err)
	}
	if !strings.Contains(string(content), `"new":true`) {
		t.Fatalf("final cache was not replaced: %s", content)
	}
	if !fileExists(filepath.Join(other, "keep.txt")) {
		t.Fatal("unrelated cache sibling should remain")
	}
}

func TestManifestUsesGoSchemaAndRejectsOldPythonManifest(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	writeFile(t, filepath.Join(repo, "main.py"), "print('ok')\n")
	payload, err := buildIndex(IndexOptions{Repo: repo, CacheDir: cache, MaxFileBytes: defaultMaxFileBytes, ChunkLines: defaultChunkLines, OverlapLines: defaultOverlapLines})
	if err != nil {
		t.Fatalf("build index: %v", err)
	}
	manifestPath := filepath.Join(payload.Cache, manifestFileName)
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("read manifest: %v", err)
	}
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatalf("decode manifest: %v", err)
	}
	if manifest.Generator != generatorName || manifest.SchemaVersion != schemaVersion || manifest.Backend != backendName {
		t.Fatalf("unexpected manifest: %+v", manifest)
	}
	writeFile(t, manifestPath, `{"schema_version":1,"repo_root":"`+repo+`"}`)
	status, err := statusIndex(StatusOptions{Repo: repo, CacheDir: cache})
	if err != nil {
		t.Fatalf("status incompatible: %v", err)
	}
	if status.Status != "stale" {
		t.Fatalf("expected stale incompatible status, got %+v", status)
	}
	if _, _, err := loadManifest(repo, cache); err == nil {
		t.Fatal("expected old python manifest to be rejected")
	}
}

func TestBM25SearchPrefersPathAndSymbolMatches(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	writeFile(t, filepath.Join(repo, "auth", "refresh_token.py"), "def refresh_token():\n    return 'token'\n")
	writeFile(t, filepath.Join(repo, "docs", "session.txt"), "refresh token notes\n")
	if _, err := buildIndex(IndexOptions{Repo: repo, CacheDir: cache, MaxFileBytes: defaultMaxFileBytes, ChunkLines: defaultChunkLines, OverlapLines: defaultOverlapLines}); err != nil {
		t.Fatalf("build index: %v", err)
	}
	search, err := searchIndex(SearchOptions{Repo: repo, CacheDir: cache, Query: "refresh token", TopK: 5, Neighbors: 3})
	if err != nil {
		t.Fatalf("search index: %v", err)
	}
	if len(search.Results) == 0 {
		t.Fatal("expected search results")
	}
	if search.Results[0].Path != "auth/refresh_token.py" {
		t.Fatalf("expected path/symbol match first, got %+v", search.Results)
	}
	if search.Results[0].ChunkPath == "" || search.Results[0].ContentHash == "" || len(search.Results[0].Symbols) == 0 {
		t.Fatalf("missing search metadata: %+v", search.Results[0])
	}
}

func TestCLIJsonAndRootRunWorkflow(t *testing.T) {
	workspace := newWorkspace(t)
	repo := initGitRepo(t, workspace)
	cache := filepath.Join(workspace, "cache")
	writeFile(t, filepath.Join(repo, "tokens.py"), "def refresh_token():\n    return 'new token'\n")
	writeFile(t, filepath.Join(repo, "auth.py"), "from tokens import refresh_token\n\ndef login():\n    return refresh_token()\n")
	root := repoRoot(t)
	run := func(args ...string) map[string]any {
		t.Helper()
		commandArgs := append([]string{"run", "docs/skills/pulse-code-context/code_context.go"}, args...)
		cmd := exec.Command("go", commandArgs...)
		cmd.Dir = root
		cmd.Env = os.Environ()
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("go %v failed: %v\n%s", commandArgs, err, string(output))
		}
		var payload map[string]any
		if err := json.Unmarshal(output, &payload); err != nil {
			t.Fatalf("decode json output %q: %v", string(output), err)
		}
		return payload
	}
	statusBefore := run("status", "--repo", repo, "--cache-dir", cache, "--json")
	if statusBefore["status"] != "missing" {
		t.Fatalf("expected missing status, got %+v", statusBefore)
	}
	indexed := run("index", "--repo", repo, "--cache-dir", cache, "--json")
	if indexed["status"] != "indexed" {
		t.Fatalf("expected indexed payload, got %+v", indexed)
	}
	searched := run("search", "refresh token", "--repo", repo, "--cache-dir", cache, "--json")
	results := searched["results"].([]any)
	if len(results) == 0 {
		t.Fatalf("expected CLI search results, got %+v", searched)
	}
	first := results[0].(map[string]any)
	if first["path"] != "tokens.py" {
		t.Fatalf("expected tokens.py first, got %+v", first)
	}
	related := run("related", "tokens.py", "--repo", repo, "--cache-dir", cache, "--json")
	relatedFiles := related["related_files"].([]any)
	if len(relatedFiles) == 0 || relatedFiles[0].(map[string]any)["path"] != "auth.py" {
		t.Fatalf("expected auth.py related, got %+v", related)
	}
	statusAfter := run("status", "--repo", repo, "--cache-dir", cache, "--json")
	if statusAfter["status"] != "ready" {
		t.Fatalf("expected ready status, got %+v", statusAfter)
	}
}

func TestDefaultRuntimeCacheBehavior(t *testing.T) {
	workspace := newWorkspace(t)
	home := filepath.Join(workspace, "home")
	repo := initGitRepo(t, workspace)
	mustMkdirAll(t, home)
	if runtime.GOOS == "darwin" {
		t.Setenv("HOME", home)
	} else if runtime.GOOS == "windows" {
		localAppData := filepath.Join(home, "AppData", "Local")
		mustMkdirAll(t, localAppData)
		t.Setenv("LOCALAPPDATA", localAppData)
	} else {
		xdg := filepath.Join(home, ".cache-root")
		mustMkdirAll(t, xdg)
		t.Setenv("XDG_CACHE_HOME", xdg)
		t.Setenv("HOME", home)
	}
	status, err := statusIndex(StatusOptions{Repo: repo})
	if err != nil {
		t.Fatalf("status with default cache: %v", err)
	}
	if status.Status != "missing" || status.Fresh {
		t.Fatalf("expected missing default-cache status, got %+v", status)
	}
	expectedRoot, err := defaultCacheRoot()
	if err != nil {
		t.Fatalf("default cache root: %v", err)
	}
	if !strings.HasPrefix(status.Cache, expectedRoot) {
		t.Fatalf("unexpected default cache path: got %s want prefix %s", status.Cache, expectedRoot)
	}
	if pathWithin(repo, status.Cache) {
		t.Fatalf("default cache path must stay outside repository: %s", status.Cache)
	}
}
