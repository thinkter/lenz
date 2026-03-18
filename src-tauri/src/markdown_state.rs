use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct MarkdownState {
    inner: Arc<MarkdownStateInner>,
}

struct MarkdownStateInner {
    content: Mutex<String>,
    path: Mutex<Option<PathBuf>>,
}

#[derive(Clone)]
pub struct MarkdownDocument {
    pub content: String,
    pub path: Option<PathBuf>,
}

impl MarkdownState {
    pub fn new(document: MarkdownDocument) -> Self {
        Self {
            inner: Arc::new(MarkdownStateInner {
                content: Mutex::new(document.content),
                path: Mutex::new(document.path),
            }),
        }
    }

    pub fn snapshot(&self) -> MarkdownDocument {
        let content = self.inner.content.lock().unwrap().clone();
        let path = self.inner.path.lock().unwrap().clone();
        MarkdownDocument { content, path }
    }

    pub fn current_path(&self) -> Option<PathBuf> {
        self.inner.path.lock().unwrap().clone()
    }

    pub fn replace_document(&self, document: MarkdownDocument) {
        {
            let mut content = self.inner.content.lock().unwrap();
            *content = document.content;
        }
        {
            let mut path = self.inner.path.lock().unwrap();
            *path = document.path;
        }
    }

    pub fn set_content_if_changed(&self, updated_content: &str) -> bool {
        let mut current_content = self.inner.content.lock().unwrap();
        if current_content.as_str() == updated_content {
            return false;
        }

        current_content.clear();
        current_content.push_str(updated_content);
        true
    }
}
