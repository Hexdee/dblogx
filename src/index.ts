import { Principal, Result, StableBTreeMap, Vec, match } from 'azle';
import { v4 as uuidv4 } from 'uuid';

// Define the Post record type
type Post = {
    id: string;
    author: Principal;
    title: string;
    content: string;
    image: string;
    createdAt: bigint;
    updatedAt?: bigint;
    comments: Vec<Comment>;
    likes: bigint;
    liked: Vec<Principal>;
};

// Define the PostPayload record type for creating and updating posts
type PostPayload = {
    title: string;
    content: string;
    image: string;
};

// Define the Comment record type
type Comment = {
    author: Principal;
    content: string;
    createdAt: bigint;
};

// Initialize a StableBTreeMap to store posts
const postStorage = new StableBTreeMap<string, Post>(0, 44, 1024);

// Query function to get all posts
export function getPosts(): Result<Vec<Post>, string> {
    return Result.Ok(postStorage.values());
}

// Query function to get a specific post by ID
export function getPost(id: string): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => Result.Ok<Post, string>(post),
        None: () => Result.Err<Post, string>(`A post with id=${id} not found`)
    });
}

// Update function to create a new post
export function post(payload: PostPayload): Result<Post, string> {
    const post: Post = { id: uuidv4(), createdAt: BigInt(Date.now()), comments: [], likes: BigInt(0), liked: [], ...payload };
    postStorage.insert(post.id, post);
    return Result.Ok(post);
}

// Update function to update an existing post
export function updatePost(id: string, payload: PostPayload): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => {
            // Check if the caller is the author of the post
            if (post.author != ic.caller()) {
                return Result.Err<Post, string>(`Only post authors can update a post`);
            }
            const updatedPost: Post = { ...post, ...payload, updatedAt: BigInt(Date.now()) };
            postStorage.insert(post.id, updatedPost);
            return Result.Ok<Post, string>(updatedPost);
        },
        None: () => Result.Err<Post, string>(`Couldn't update a post with id=${id}. Post not found`)
    });
}

// Update function to delete a post
export function deletePost(id: string): Result<Post, string> {
    return match(postStorage.remove(id), {
        Some: (deletedPost) => {
            // Check if the caller is the author of the post
            if (deletedPost.author != ic.caller()) {
                return Result.Err<Post, string>(`Only post authors can delete a post`);
            }
            return Result.Ok<Post, string>(deletedPost);
        },
        None: () => Result.Err<Post, string>(`Couldn't delete a post with id=${id}. Post not found.`)
    });
}

// Update function to add a comment to a post
export function comment(postId: string, content: string): Result<Comment, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const comment: Comment = { content, author: ic.caller(), createdAt: BigInt(Date.now()) };
            post.comments.push(comment);
            postStorage.insert(post.id, post);
            return Result.Ok<Comment, string>(comment);
        },
        None: () => Result.Err<Post, string>(`Couldn't comment on a post with id=${postId}. Post not found`)
    });
}

// Update function to like a post
export function like(postId: string): Result<bigint, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            // Check if the caller has already liked the post
            const hasLiked = post.liked.findIndex(caller => caller == ic.caller());
            if (hasLiked != -1) {
                return Result.Err<bigint, string>(`You can't like a post twice`);
            }
            post.likes = post.likes + BigInt(1);
            post.liked.push(ic.caller());
            postStorage.insert(post.id, post);
            return Result.Ok<bigint, string>(post.likes);
        },
        None: () => Result.Err<bigint, string>(`Couldn't like a post with id=${postId}. Post not found`)
    })
}

// Update function to unlike a post
export function unlike(postId: string): Result<bigint, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            // Check if the caller has liked the post
            const hasLiked = post.liked.findIndex(caller => caller == ic.caller());
            if (hasLiked == -1) {
                return Result.Err<bigint, string>(`You haven't liked this post`);
            }
            post.likes = post.likes - BigInt(1);
            post.liked.splice(hasLiked, 1);
            postStorage.insert(post.id, post);
            return Result.Ok<bigint, string>(post.likes);
        },
        None: () => Result.Err<bigint, string>(`Couldn't unlike a post with id=${postId}. Post not found`)
    })
}
