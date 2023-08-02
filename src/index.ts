// cannister code goes here
import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal, nat } from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Post = Record<{
    id: string;
    author: Principal;
    title: string;
    content: string;
    image: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
    comments: Vec<Comment>;
    likes: nat;
    liked: Vec<Principal>;
}>

type PostPayload = Record<{
    title: string;
    content: string;
    image: string;
}>

type Comment = Record<{
    author: Principal;
    content: string;
    createdAt: nat64;
}>

const postStorage = new StableBTreeMap<string, Post>(0, 44, 1024);

$query;
export function getPosts(): Result<Vec<Post>, string> {
    return Result.Ok(postStorage.values());
}

$query;
export function getPost(id: string): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => Result.Ok<Post, string>(post),
        None: () => Result.Err<Post, string>(`a post with id=${id} not found`)
    });
}

$update;
export function post(payload: PostPayload): Result<Post, string> {
    const post: Post = { id: uuidv4(), createdAt: ic.time(), updatedAt: Opt.None, author: ic.caller(), comments: [], likes: 0n, liked: [], ...payload };
    postStorage.insert(post.id, post);
    return Result.Ok(post);
}

$update;
export function updatePost(id: string, payload: PostPayload): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => {
            if (post.author != ic.caller()) {
                return Result.Err<Post, string>(`only post authors can update a post`)
            }
            const updatedPost: Post = {...post, ...payload, updatedAt: Opt.Some(ic.time())};
            postStorage.insert(post.id, updatedPost);
            return Result.Ok<Post, string>(updatedPost);
        },
        None: () => Result.Err<Post, string>(`couldn't update a post with id=${id}. post not found`)
    });
}

$update;
export function deletePost(id: string): Result<Post, string> {
    return match(postStorage.remove(id), {
        Some: (deletedPost) => {
            if (deletedPost.author != ic.caller()) {
                return Result.Err<Post, string>(`only post authors can delete a post`)
            }
            return Result.Ok<Post, string>(deletedPost)
        },
        None: () => Result.Err<Post, string>(`couldn't delete a post with id=${id}. message not found.`)
    });
}

$update;
export function comment(postId: string, content: string): Result<Comment, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const comment: Comment = {content, author: ic.caller(), createdAt: ic.time()};
            post.comments.push(comment);
            postStorage.insert(post.id, post);
            return Result.Ok<Comment, string>(comment);
        },
        None: () => Result.Err<Post, string>(`couldn't comment on a post with id=${postId}. post not found`)
    });
}

$update;
export function like(postId: string): Result<nat, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const hasLiked = post.liked.findIndex(caller => caller == ic.caller());
            if (hasLiked != -1) {
                return Result.Err<nat, string>(`you can't like a post twice`);
            }
            post.likes = post.likes + 1n;
            post.liked.push(ic.caller());
            postStorage.insert(post.id, post);
            return Result.Ok<nat, string>(post.likes);
        },
        None: () => Result.Err<nat, string>(`couldn't like a post with id=${postId}. post not found`)
    })
}

$update;
export function unlike(postId: string): Result<nat, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const hasLiked = post.liked.findIndex(caller => caller == ic.caller());
            if (hasLiked == -1) {
                return Result.Err<nat, string>(`you haven't liked this post`);
            }
            post.likes = post.likes - 1n;
            post.liked.splice(hasLiked, 1);
            postStorage.insert(post.id, post);
            return Result.Ok<nat, string>(post.likes);
        },
        None: () => Result.Err<nat, string>(`couldn't unlike a post with id=${postId}. post not found`)
    })
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};